import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Scale, Brain, ArrowLeft, Send, Bot, User } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const AIConsultation = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'مرحباً! أنا المساعد القانوني الذكي. يمكنك طرح أسئلتك القانونية وسأحاول مساعدتك.\n\n⚠️ ملاحظة: هذه استشارة أولية ولا تغني عن استشارة محامٍ مختص.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    // Simulated AI response (would connect to an AI edge function in production)
    setTimeout(() => {
      const responses = [
        'شكراً على سؤالك. بناءً على القانون المغربي، هذه المسألة تتطلب دراسة معمقة. أنصحك بالتواصل مع محامٍ مختص للحصول على استشارة دقيقة.',
        'هذا سؤال مهم. في إطار القانون المغربي، يمكنني إفادتك أن المسطرة المتبعة تتضمن عدة مراحل. يُفضل تقديم ملف كامل لمحاميك لدراسة كافة الجوانب.',
        'بحسب مقتضيات القانون المغربي، هذه المسألة تخضع لعدة نصوص قانونية. أنصحك بجمع كافة الوثائق ذات الصلة والتواصل مع محامٍ.',
      ];
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: responses[Math.floor(Math.random() * responses.length)] },
      ]);
      setLoading(false);
    }, 1500);
  };

  return (
    <>
      <Helmet>
        <title>الاستشارة الذكية - محاماة ذكية</title>
        <meta name="description" content="استشارة قانونية ذكية بالذكاء الاصطناعي" />
      </Helmet>
      <div className="min-h-screen bg-background flex flex-col">
        <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
          <div className="container mx-auto px-4 flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <Scale className="h-6 w-6 text-primary" />
              <span className="text-lg font-bold">محاماة ذكية</span>
            </Link>
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
              الرئيسية <ArrowLeft className="h-3 w-3" />
            </Link>
          </div>
        </nav>

        <main className="flex-1 container mx-auto px-4 py-6 max-w-3xl flex flex-col">
          <div className="text-center mb-6 space-y-2">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Brain className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">الاستشارة الذكية</h1>
            <p className="text-sm text-muted-foreground">اطرح سؤالك القانوني واحصل على إجابة فورية</p>
          </div>

          <Card className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4" style={{ maxHeight: 'calc(100vh - 350px)' }}>
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                  >
                    <div
                      className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                        msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}
                    >
                      {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                    </div>
                    <div
                      className={`rounded-xl px-4 py-3 max-w-[80%] text-sm whitespace-pre-wrap ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="bg-muted rounded-xl px-4 py-3">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" />
                        <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                        <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <CardContent className="border-t border-border p-4">
              <div className="flex gap-2">
                <Textarea
                  placeholder="اكتب سؤالك القانوني هنا..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  className="min-h-[44px] max-h-32 resize-none"
                  rows={1}
                />
                <Button onClick={handleSend} disabled={loading || !input.trim()} size="icon" className="shrink-0">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </>
  );
};

export default AIConsultation;
