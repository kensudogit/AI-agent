import { z } from 'zod';
import {
  MAX_CHAT_MESSAGES,
  MAX_MESSAGE_CONTENT_LENGTH,
  MAX_TITLE_LENGTH,
  MAX_NEGOTIATION_MESSAGES,
  MAX_NEGOTIATION_INPUT_LENGTH,
  MAX_LIST_LIMIT,
} from '@/lib/constants';

const roleEnum = z.enum(['user', 'assistant', 'system']);
const contentString = z.string().max(MAX_MESSAGE_CONTENT_LENGTH);

/** チャット API 用: 1件のメッセージ */
const chatMessageSchema = z.object({
  role: roleEnum,
  content: contentString,
  tool_calls: z.unknown().optional(),
  tool_call_id: z.string().optional(),
});

/** チャット POST body（conversationId は未設定時に null が送られることがある） */
export const chatBodySchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(MAX_CHAT_MESSAGES),
  conversationId: z.string().uuid().nullish(),
});

/** 模擬商談チャット用: メッセージ */
const negotiationMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().max(MAX_NEGOTIATION_INPUT_LENGTH),
});

const scenarioIdSchema = z.enum([
  'b2b_saas',
  'price_delivery',
  'first_visit',
  'recruitment',
  'media_sponsor',
  'outsourcing',
  'enterprise_license',
  'renewal_contract',
  'partnership_mou',
  'real_estate_lease',
  'consulting_fee',
  'maintenance_sla',
]);
const userRoleSchema = z.enum(['sales', 'customer']);
const difficultySchema = z.enum(['easy', 'standard', 'hard']);

/** 模擬商談チャット POST body */
export const negotiationChatBodySchema = z.object({
  messages: z.array(negotiationMessageSchema).min(1).max(MAX_NEGOTIATION_MESSAGES),
  scenarioId: scenarioIdSchema,
  userRole: userRoleSchema,
  difficulty: difficultySchema.optional(),
});

/** 模擬商談フィードバック POST body */
export const negotiationFeedbackBodySchema = z.object({
  messages: z.array(negotiationMessageSchema).min(1).max(MAX_NEGOTIATION_MESSAGES),
  scenarioId: scenarioIdSchema,
  userRole: userRoleSchema,
  difficulty: difficultySchema.optional(),
  saveSession: z.boolean().optional(),
});

/** 会話作成 POST body */
export const conversationBodySchema = z.object({
  title: z.string().max(MAX_TITLE_LENGTH).optional(),
});

/** 会話一覧 GET: query (将来のページネーション用) */
export const conversationListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
}).optional();

export type ChatBody = z.infer<typeof chatBodySchema>;
export type NegotiationChatBody = z.infer<typeof negotiationChatBodySchema>;
export type NegotiationFeedbackBody = z.infer<typeof negotiationFeedbackBodySchema>;
export type ConversationBody = z.infer<typeof conversationBodySchema>;
