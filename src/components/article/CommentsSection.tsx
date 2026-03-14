import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, ThumbsUp, Reply, Trash2, Send, LogIn, ChevronDown, BadgeCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

interface Comment {
  id: string;
  article_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  updated_at: string;
  profile?: { full_name: string | null; avatar_url: string | null };
  reactions_count: number;
  user_reacted: boolean;
  replies?: Comment[];
}

interface CommentsSectionProps {
  articleId: string;
}

const CommentsSection = ({ articleId }: CommentsSectionProps) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showAllComments, setShowAllComments] = useState(false);

  // Auth state
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id || null);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id || null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Fetch comments
  const fetchComments = useCallback(async () => {
    const { data: commentsData } = await supabase
      .from('comments')
      .select('*')
      .eq('article_id', articleId)
      .order('created_at', { ascending: false });

    if (!commentsData) { setLoading(false); return; }

    // Fetch profiles for all unique user_ids
    const userIds = [...new Set(commentsData.map(c => c.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, avatar_url')
      .in('user_id', userIds);

    // Fetch reactions counts
    const commentIds = commentsData.map(c => c.id);
    const { data: reactions } = await supabase
      .from('comment_reactions')
      .select('comment_id, user_id')
      .in('comment_id', commentIds);

    const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
    const reactionCounts = new Map<string, number>();
    const userReactions = new Set<string>();
    (reactions || []).forEach(r => {
      reactionCounts.set(r.comment_id, (reactionCounts.get(r.comment_id) || 0) + 1);
      if (r.user_id === userId) userReactions.add(r.comment_id);
    });

    const enriched: Comment[] = commentsData.map(c => ({
      ...c,
      profile: profileMap.get(c.user_id) || { full_name: null, avatar_url: null },
      reactions_count: reactionCounts.get(c.id) || 0,
      user_reacted: userReactions.has(c.id),
    }));

    // Nest replies
    const topLevel: Comment[] = [];
    const replyMap = new Map<string, Comment[]>();
    enriched.forEach(c => {
      if (c.parent_id) {
        if (!replyMap.has(c.parent_id)) replyMap.set(c.parent_id, []);
        replyMap.get(c.parent_id)!.push(c);
      } else {
        topLevel.push(c);
      }
    });
    topLevel.forEach(c => {
      c.replies = (replyMap.get(c.id) || []).sort((a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    });

    setComments(topLevel);
    setLoading(false);
  }, [articleId, userId]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('comments-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `article_id=eq.${articleId}` }, () => {
        fetchComments();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [articleId, fetchComments]);

  const handleSubmit = async (parentId: string | null = null) => {
    if (!userId) return;
    const content = parentId ? replyContent : newComment;
    if (!content.trim()) return;
    setSubmitting(true);

    const { error } = await supabase.from('comments').insert({
      article_id: articleId,
      user_id: userId,
      parent_id: parentId,
      content: content.trim(),
    });

    if (error) {
      toast.error('حدث خطأ أثناء إضافة التعليق');
    } else {
      toast.success('تم إضافة تعليقك');
      if (parentId) { setReplyContent(''); setReplyTo(null); }
      else setNewComment('');
      fetchComments();
    }
    setSubmitting(false);
  };

  const handleReaction = async (commentId: string, userReacted: boolean) => {
    if (!userId) { toast.info('سجل دخولك للتفاعل'); return; }
    if (userReacted) {
      await supabase.from('comment_reactions').delete()
        .eq('comment_id', commentId).eq('user_id', userId);
    } else {
      await supabase.from('comment_reactions').insert({
        comment_id: commentId, user_id: userId, reaction_type: 'like',
      });
    }
    fetchComments();
  };

  const handleDelete = async (commentId: string) => {
    const { error } = await supabase.from('comments').delete().eq('id', commentId);
    if (!error) { toast.success('تم حذف التعليق'); fetchComments(); }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'الآن';
    if (mins < 60) return `منذ ${mins} دقيقة`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `منذ ${hours} ساعة`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `منذ ${days} يوم`;
    return new Date(dateStr).toLocaleDateString('ar-MA');
  };

  const displayedComments = showAllComments ? comments : comments.slice(0, 5);

  const CommentCard = ({ comment, isReply = false }: { comment: Comment; isReply?: boolean }) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`${isReply ? 'mr-6 sm:mr-10 border-r-2 border-legal-navy/10 pr-4' : ''}`}
    >
      <div className="group py-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-legal-navy/15 to-legal-gold/10 flex items-center justify-center shrink-0 text-sm font-bold text-legal-navy">
            {comment.profile?.full_name?.charAt(0) || '؟'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-foreground">
                {comment.profile?.full_name || 'مستخدم'}
              </span>
              {comment.user_id === userId && (
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-legal-emerald/30 text-legal-emerald rounded-full">أنت</Badge>
              )}
              <span className="text-[10px] text-muted-foreground">{timeAgo(comment.created_at)}</span>
            </div>

            {/* Content */}
            <p className="mt-1.5 text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{comment.content}</p>

            {/* Actions */}
            <div className="flex items-center gap-1 mt-2">
              <button
                onClick={() => handleReaction(comment.id, comment.user_reacted)}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] transition-all ${
                  comment.user_reacted
                    ? 'bg-legal-navy/10 text-legal-navy font-semibold'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <ThumbsUp className="h-3 w-3" />
                {comment.reactions_count > 0 && comment.reactions_count}
              </button>

              {!isReply && userId && (
                <button
                  onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
                >
                  <Reply className="h-3 w-3" /> رد
                </button>
              )}

              {comment.user_id === userId && (
                <button
                  onClick={() => handleDelete(comment.id)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Reply form */}
            <AnimatePresence>
              {replyTo === comment.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mt-3"
                >
                  <div className="flex gap-2">
                    <textarea
                      value={replyContent}
                      onChange={e => setReplyContent(e.target.value)}
                      placeholder="اكتب ردك..."
                      className="flex-1 min-h-[60px] rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-legal-navy/20 focus:border-legal-navy/40 resize-none transition-all"
                      dir="rtl"
                    />
                    <Button
                      onClick={() => handleSubmit(comment.id)}
                      disabled={submitting || !replyContent.trim()}
                      size="icon"
                      className="h-10 w-10 rounded-xl bg-legal-navy hover:bg-legal-navy/90 text-white shrink-0 self-end"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="space-y-0">
          {comment.replies.map(reply => (
            <CommentCard key={reply.id} comment={reply} isReply />
          ))}
        </div>
      )}
    </motion.div>
  );

  return (
    <section className="mt-14 print:hidden">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-legal-navy/10 flex items-center justify-center">
          <MessageCircle className="h-5 w-5 text-legal-navy" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground font-legal">
            التعليقات والنقاش
          </h2>
          <p className="text-xs text-muted-foreground">
            {comments.length > 0 ? `${comments.length} تعليق` : 'كن أول من يعلق'}
          </p>
        </div>
      </div>

      {/* New comment form */}
      {userId ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 rounded-2xl border border-border/40 bg-card p-4 sm:p-5 shadow-sm"
        >
          <textarea
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            placeholder="شارك رأيك أو سؤالك القانوني..."
            className="w-full min-h-[90px] rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-legal-navy/20 focus:border-legal-navy/40 resize-none transition-all"
            dir="rtl"
          />
          <div className="flex items-center justify-between mt-3">
            <p className="text-[10px] text-muted-foreground">التعليقات تخضع للمراجعة</p>
            <Button
              onClick={() => handleSubmit(null)}
              disabled={submitting || !newComment.trim()}
              className="gap-1.5 rounded-xl bg-legal-navy hover:bg-legal-navy/90 text-white text-xs h-9 px-4"
            >
              <Send className="h-3.5 w-3.5" /> نشر التعليق
            </Button>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 rounded-2xl border border-border/40 bg-muted/20 p-5 sm:p-6 text-center"
        >
          <LogIn className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-foreground font-medium mb-1">سجل دخولك للمشاركة في النقاش</p>
          <p className="text-xs text-muted-foreground mb-4">شارك رأيك واطرح أسئلتك القانونية</p>
          <Link to="/auth">
            <Button className="gap-2 rounded-xl bg-legal-navy hover:bg-legal-navy/90 text-white text-xs">
              <LogIn className="h-3.5 w-3.5" /> تسجيل الدخول
            </Button>
          </Link>
        </motion.div>
      )}

      {/* Comments list */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-9 h-9 rounded-full bg-muted shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-muted rounded w-1/4" />
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <MessageCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">لا توجد تعليقات بعد — كن أول من يشارك</p>
        </div>
      ) : (
        <div className="divide-y divide-border/20">
          <AnimatePresence>
            {displayedComments.map(comment => (
              <CommentCard key={comment.id} comment={comment} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Show more */}
      {comments.length > 5 && !showAllComments && (
        <div className="text-center mt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAllComments(true)}
            className="gap-1.5 rounded-xl text-xs"
          >
            <ChevronDown className="h-3 w-3" /> عرض كل التعليقات ({comments.length})
          </Button>
        </div>
      )}
    </section>
  );
};

export default CommentsSection;
