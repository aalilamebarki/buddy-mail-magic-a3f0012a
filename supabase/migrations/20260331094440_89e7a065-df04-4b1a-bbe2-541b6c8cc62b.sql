
-- إنشاء جدول المهام
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'new',
  priority text NOT NULL DEFAULT 'medium',
  assigned_to uuid,
  created_by uuid,
  case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL,
  due_date date,
  is_automated boolean DEFAULT false,
  automation_source text,
  comments_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- إنشاء جدول المواعيد القانونية
CREATE TABLE IF NOT EXISTS public.legal_deadlines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL,
  case_id uuid REFERENCES public.cases(id) ON DELETE CASCADE,
  deadline_type text NOT NULL,
  deadline_date date NOT NULL,
  notification_date date,
  days_total integer,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- إنشاء جدول قواعد الأتمتة للمهام
CREATE TABLE IF NOT EXISTS public.task_automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL,
  name text NOT NULL,
  trigger_event text NOT NULL,
  task_title_template text NOT NULL,
  task_description_template text,
  assign_to_role text,
  priority text DEFAULT 'medium',
  due_days integer DEFAULT 3,
  is_active boolean DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- إنشاء جدول تعليقات المهام
CREATE TABLE IF NOT EXISTS public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- الفهارس
CREATE INDEX IF NOT EXISTS idx_tasks_office_id ON public.tasks(office_id);
CREATE INDEX IF NOT EXISTS idx_tasks_case_id ON public.tasks(case_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_legal_deadlines_office_id ON public.legal_deadlines(office_id);
CREATE INDEX IF NOT EXISTS idx_legal_deadlines_deadline_date ON public.legal_deadlines(deadline_date);
CREATE INDEX IF NOT EXISTS idx_task_automation_rules_office_id ON public.task_automation_rules(office_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON public.task_comments(task_id);

-- تفعيل RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_deadlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- سياسات RLS للمهام
CREATE POLICY "Authenticated users can view tasks" ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update tasks" ON public.tasks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete tasks" ON public.tasks FOR DELETE TO authenticated USING (true);

-- سياسات RLS للمواعيد القانونية
CREATE POLICY "Authenticated users can view deadlines" ON public.legal_deadlines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert deadlines" ON public.legal_deadlines FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update deadlines" ON public.legal_deadlines FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete deadlines" ON public.legal_deadlines FOR DELETE TO authenticated USING (true);

-- سياسات RLS لقواعد الأتمتة
CREATE POLICY "Authenticated users can view automation rules" ON public.task_automation_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage automation rules" ON public.task_automation_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- سياسات RLS لتعليقات المهام
CREATE POLICY "Authenticated users can view task comments" ON public.task_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert task comments" ON public.task_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own task comments" ON public.task_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Trigger لتحديث updated_at
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_legal_deadlines_updated_at BEFORE UPDATE ON public.legal_deadlines FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_task_automation_rules_updated_at BEFORE UPDATE ON public.task_automation_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
