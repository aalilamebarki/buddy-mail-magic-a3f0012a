
-- Comments table
CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Comment reactions table
CREATE TABLE public.comment_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction_type text NOT NULL DEFAULT 'like',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(comment_id, user_id, reaction_type)
);

-- Article reactions table (like/bookmark on the article itself)
CREATE TABLE public.article_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction_type text NOT NULL DEFAULT 'like',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(article_id, user_id, reaction_type)
);

-- Enable RLS
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_reactions ENABLE ROW LEVEL SECURITY;

-- Comments RLS
CREATE POLICY "Anyone can view comments" ON public.comments FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated users can insert comments" ON public.comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own comments" ON public.comments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Comment reactions RLS
CREATE POLICY "Anyone can view comment reactions" ON public.comment_reactions FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated users can insert reactions" ON public.comment_reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own reactions" ON public.comment_reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Article reactions RLS
CREATE POLICY "Anyone can view article reactions" ON public.article_reactions FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated users can insert article reactions" ON public.article_reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own article reactions" ON public.article_reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Enable realtime for comments
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;

-- Trigger for updated_at
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
