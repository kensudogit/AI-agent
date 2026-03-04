-- AI Agent: conversations and messages
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) DEFAULT 'New conversation',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  tool_calls JSONB,
  tool_call_id VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);

-- 模擬商談セッション（履歴・フィードバック保存）
CREATE TABLE IF NOT EXISTS negotiation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id VARCHAR(50) NOT NULL,
  user_role VARCHAR(20) NOT NULL CHECK (user_role IN ('sales', 'customer')),
  difficulty VARCHAR(20) NOT NULL DEFAULT 'standard' CHECK (difficulty IN ('easy', 'standard', 'hard')),
  title VARCHAR(300) DEFAULT '',
  feedback_raw TEXT,
  feedback_good JSONB,
  feedback_improve JSONB,
  feedback_advice TEXT,
  overall_score INTEGER CHECK (overall_score >= 1 AND overall_score <= 5),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS negotiation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES negotiation_sessions(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_negotiation_messages_session ON negotiation_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_negotiation_sessions_created ON negotiation_sessions(created_at DESC);
