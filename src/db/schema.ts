import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";

/** The enum values are deliberately lower-case: they are API/storage values, not UI labels. */
export const globalRole = pgEnum("global_role", ["user", "platform_admin"]);
export const storeRole = pgEnum("store_role", ["clerk", "manager", "owner"]);
export const trustLevel = pgEnum("trust_level", ["unverified", "verified"]);
export const catalogStatus = pgEnum("catalog_status", ["staged", "active", "retired"]);
export const itemStatus = pgEnum("item_status", ["active", "retired", "merged"]);
export const receiptDirection = pgEnum("receipt_direction", ["store_purchase", "store_sale"]);
export const receiptStatus = pgEnum("receipt_status", ["draft", "pending", "approved", "rejected", "voided"]);
export const stockMovementKind = pgEnum("stock_movement_kind", ["receipt", "correction", "approval_transfer", "rejection_reversal", "void_reversal"]);
// State is the balance bucket affected by this immutable posting. Reversals are negative postings,
// not mutable state changes, so every historical balance can be reconstructed by summing this log.
export const stockMovementState = pgEnum("stock_movement_state", ["provisional", "confirmed"]);
export const observationKind = pgEnum("observation_kind", ["seen_listing", "direct_quote", "hearsay"]);
export const marketSide = pgEnum("market_side", ["store_pays", "customer_pays"]);
export const approvalDecision = pgEnum("approval_decision", ["pending", "approved", "rejected"]);
export const approvalTarget = pgEnum("approval_target", ["receipt", "observation", "recipe", "stock_correction", "public_market_report"]);
export const publicMarketReportLocation = pgEnum("public_market_report_location", ["store_sale", "street_sale"]);
export const jobStatus = pgEnum("job_status", ["queued", "running", "completed", "failed", "cancelled"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  // Auth.js creates the user before linking the Discord account. The link event
  // immediately mirrors providerAccountId here; nullable only during that gap.
  discordId: varchar("discord_id", { length: 32 }).unique(),
  name: varchar("name", { length: 128 }), email: varchar("email", { length: 255 }), emailVerified: timestamp("email_verified", { withTimezone: true }),
  image: text("image"),
  // Public contributors use this RP name in reports; Discord identity remains
  // the immutable authentication and audit identity.
  displayName: varchar("display_name", { length: 120 }),
  globalRole: globalRole("global_role").notNull().default("user"),
  quarantinedAt: timestamp("quarantined_at", { withTimezone: true }),
  quarantineReason: text("quarantine_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

// Auth.js Drizzle adapter-compatible table shapes. Discord identity is additionally mirrored in users.discordId.
export const accounts = pgTable("accounts", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 255 }).notNull(),
  provider: varchar("provider", { length: 255 }).notNull(),
  providerAccountId: varchar("provider_account_id", { length: 255 }).notNull(),
  refresh_token: text("refresh_token"), token_type: varchar("token_type", { length: 255 }), scope: varchar("scope", { length: 255 }),
  access_token: text("access_token"), expires_at: integer("expires_at"), id_token: text("id_token"), session_state: varchar("session_state", { length: 255 })
}, (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] }), index("accounts_user_idx").on(t.userId)]);

export const sessions = pgTable("sessions", {
  sessionToken: varchar("session_token", { length: 255 }).notNull().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull()
}, (t) => [index("sessions_user_idx").on(t.userId)]);

export const verificationTokens = pgTable("verification_tokens", {
  identifier: varchar("identifier", { length: 255 }).notNull(), token: varchar("token", { length: 255 }).notNull(), expires: timestamp("expires", { withTimezone: true }).notNull()
}, (t) => [primaryKey({ columns: [t.identifier, t.token] })]);

export const stores = pgTable("stores", {
  id: uuid("id").defaultRandom().primaryKey(), slug: varchar("slug", { length: 80 }).notNull().unique(), name: varchar("name", { length: 120 }).notNull(),
  // A catalog import may install published reference prices before the real owner first signs in.
  // Ownership is claimed only by the configured administrator's immutable Discord identity.
  ownerId: uuid("owner_id").references(() => users.id), active: boolean("active").notNull().default(false),
  targetMarkupBps: integer("target_markup_bps").notNull().default(2500),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => [check("stores_markup_bounds", sql`${t.targetMarkupBps} between 0 and 100000`)]);

export const memberships = pgTable("memberships", {
  storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }), userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: storeRole("role").notNull().default("clerk"), trust: trustLevel("trust").notNull().default("unverified"), displayName: varchar("display_name", { length: 120 }),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(), revokedAt: timestamp("revoked_at", { withTimezone: true })
}, (t) => [primaryKey({ columns: [t.storeId, t.userId] }), index("memberships_user_idx").on(t.userId)]);

export const agreementAcceptances = pgTable("agreement_acceptances", {
  id: uuid("id").defaultRandom().primaryKey(), storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id), agreementVersion: varchar("agreement_version", { length: 64 }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow(), ipHash: varchar("ip_hash", { length: 128 })
}, (t) => [uniqueIndex("agreement_acceptance_once").on(t.storeId, t.userId, t.agreementVersion)]);

export const catalogVersions = pgTable("catalog_versions", {
  id: uuid("id").defaultRandom().primaryKey(), version: varchar("version", { length: 80 }).notNull().unique(), status: catalogStatus("status").notNull().default("staged"),
  sourceLoadOrderHash: varchar("source_load_order_hash", { length: 128 }).notNull(), activatedAt: timestamp("activated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const catalogItems = pgTable("catalog_items", {
  id: uuid("id").defaultRandom().primaryKey(), catalogVersionId: uuid("catalog_version_id").references(() => catalogVersions.id),
  stableKey: varchar("stable_key", { length: 180 }).notNull().unique(), plugin: varchar("plugin", { length: 128 }), localFormId: varchar("local_form_id", { length: 16 }),
  displayName: varchar("display_name", { length: 255 }).notNull(), editorId: varchar("editor_id", { length: 255 }), recordType: varchar("record_type", { length: 32 }).notNull(),
  category: varchar("category", { length: 80 }).notNull(), status: itemStatus("status").notNull().default("active"), mergedIntoId: uuid("merged_into_id"),
  value: integer("value"), weight: numeric("weight", { precision: 10, scale: 3 }), metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), retiredAt: timestamp("retired_at", { withTimezone: true })
}, (t) => [index("catalog_items_name_idx").on(t.displayName), index("catalog_items_category_idx").on(t.category), uniqueIndex("catalog_items_plugin_form_idx").on(t.plugin, t.localFormId)]);

export const catalogAliases = pgTable("catalog_aliases", {
  id: uuid("id").defaultRandom().primaryKey(), itemId: uuid("item_id").notNull().references(() => catalogItems.id), alias: varchar("alias", { length: 255 }).notNull(), normalizedAlias: varchar("normalized_alias", { length: 255 }).notNull()
}, (t) => [uniqueIndex("catalog_aliases_normalized_unique").on(t.normalizedAlias), index("catalog_aliases_item_idx").on(t.itemId)]);

export const catalogImages = pgTable("catalog_images", {
  id: uuid("id").defaultRandom().primaryKey(), itemId: uuid("item_id").notNull().references(() => catalogItems.id, { onDelete: "cascade" }),
  url: text("url").notNull(), kind: varchar("kind", { length: 32 }).notNull().default("fallback"), isFallback: boolean("is_fallback").notNull().default(false), width: integer("width"), height: integer("height")
}, (t) => [index("catalog_images_item_idx").on(t.itemId)]);

export const recipes = pgTable("recipes", {
  id: uuid("id").defaultRandom().primaryKey(), outputItemId: uuid("output_item_id").notNull().references(() => catalogItems.id), outputYield: integer("output_yield").notNull().default(1), masteryTier: varchar("mastery_tier", { length: 80 }), laborFee: integer("labor_fee").notNull().default(0),
  // Builder imports have no human submitter. Their source key/version/provenance stays distinct from staff recipes.
  submittedBy: uuid("submitted_by").references(() => users.id), storeId: uuid("store_id").references(() => stores.id), catalogVersionId: uuid("catalog_version_id").references(() => catalogVersions.id), sourceStableKey: varchar("source_stable_key", { length: 180 }), workbenchKey: varchar("workbench_key", { length: 255 }), profession: varchar("profession", { length: 80 }), conditions: jsonb("conditions").notNull().default([]), sourceReferences: jsonb("source_references").notNull().default([]), approval: approvalDecision("approval").notNull().default("pending"), isCatalogDefault: boolean("is_catalog_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => [check("recipes_positive_yield", sql`${t.outputYield} > 0`), check("recipes_nonnegative_labor", sql`${t.laborFee} >= 0`), index("recipes_output_idx").on(t.outputItemId), uniqueIndex("recipes_import_source_unique").on(t.sourceStableKey)]);

export const recipeIngredients = pgTable("recipe_ingredients", {
  recipeId: uuid("recipe_id").notNull().references(() => recipes.id, { onDelete: "cascade" }), itemId: uuid("item_id").notNull().references(() => catalogItems.id), quantity: integer("quantity").notNull()
}, (t) => [primaryKey({ columns: [t.recipeId, t.itemId] }), check("recipe_ingredient_positive", sql`${t.quantity} > 0`)]);

export const receipts = pgTable("receipts", {
  id: uuid("id").defaultRandom().primaryKey(), storeId: uuid("store_id").notNull().references(() => stores.id), direction: receiptDirection("direction").notNull(), status: receiptStatus("status").notNull().default("draft"),
  occurrenceAt: timestamp("occurrence_at", { withTimezone: true }).notNull(), counterpartyLabel: varchar("counterparty_label", { length: 160 }), notes: text("notes"), totalSeptims: integer("total_septims").notNull(),
  submittedBy: uuid("submitted_by").notNull().references(() => users.id), approvedBy: uuid("approved_by").references(() => users.id), approvedAt: timestamp("approved_at", { withTimezone: true }), voidedAt: timestamp("voided_at", { withTimezone: true }), voidReason: text("void_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => [check("receipt_total_nonnegative", sql`${t.totalSeptims} >= 0`), index("receipts_store_time_idx").on(t.storeId, t.occurrenceAt), index("receipts_status_idx").on(t.status)]);

export const receiptLines = pgTable("receipt_lines", {
  id: uuid("id").defaultRandom().primaryKey(), receiptId: uuid("receipt_id").notNull().references(() => receipts.id, { onDelete: "cascade" }), itemId: uuid("item_id").notNull().references(() => catalogItems.id),
  quantity: integer("quantity").notNull(), totalSeptims: integer("total_septims").notNull(), sequence: integer("sequence").notNull()
}, (t) => [check("receipt_line_positive_quantity", sql`${t.quantity} > 0`), check("receipt_line_nonnegative_total", sql`${t.totalSeptims} >= 0`), uniqueIndex("receipt_lines_sequence_unique").on(t.receiptId, t.sequence), index("receipt_lines_item_idx").on(t.itemId)]);

export const stockMovements = pgTable("stock_movements", {
  id: uuid("id").defaultRandom().primaryKey(), storeId: uuid("store_id").notNull().references(() => stores.id), itemId: uuid("item_id").notNull().references(() => catalogItems.id),
  receiptId: uuid("receipt_id").references(() => receipts.id), kind: stockMovementKind("kind").notNull(), state: stockMovementState("state").notNull(), quantityDelta: integer("quantity_delta").notNull(), reason: text("reason"),
  createdBy: uuid("created_by").notNull().references(() => users.id), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => [check("stock_movement_nonzero", sql`${t.quantityDelta} <> 0`), index("stock_movements_balance_idx").on(t.storeId, t.itemId, t.createdAt), uniqueIndex("stock_movement_receipt_posting_once").on(t.receiptId, t.itemId, t.kind, t.state)]);

export const observations = pgTable("observations", {
  id: uuid("id").defaultRandom().primaryKey(), storeId: uuid("store_id").references(() => stores.id), itemId: uuid("item_id").notNull().references(() => catalogItems.id),
  side: marketSide("side").notNull(), kind: observationKind("kind").notNull(), quantity: integer("quantity").notNull(), totalSeptims: integer("total_septims").notNull(), sourceLocation: varchar("source_location", { length: 180 }), occurrenceAt: timestamp("occurrence_at", { withTimezone: true }).notNull(), expiresAt: timestamp("expires_at", { withTimezone: true }), note: text("note"),
  submittedBy: uuid("submitted_by").notNull().references(() => users.id), approval: approvalDecision("approval").notNull().default("pending"), quarantinedAt: timestamp("quarantined_at", { withTimezone: true }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => [check("observation_positive_quantity", sql`${t.quantity} > 0`), check("observation_nonnegative_total", sql`${t.totalSeptims} >= 0`), index("observations_item_side_time_idx").on(t.itemId, t.side, t.occurrenceAt)]);

// Public contributors have no tenant affiliation. Their reports are deliberately
// separate from store receipts and staff observations: they never move stock,
// and require a platform-admin decision before becoming any kind of signal.
export const publicMarketReports = pgTable("public_market_reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  itemId: uuid("item_id").notNull().references(() => catalogItems.id),
  quantity: integer("quantity").notNull(),
  totalSeptims: integer("total_septims").notNull(),
  locationType: publicMarketReportLocation("location_type").notNull(),
  note: text("note"),
  submittedBy: uuid("submitted_by").notNull().references(() => users.id),
  contributorDisplayName: varchar("contributor_display_name", { length: 120 }).notNull(),
  status: approvalDecision("status").notNull().default("pending"),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewNote: text("review_note"),
  quarantinedAt: timestamp("quarantined_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => [
  check("public_market_report_positive_quantity", sql`${t.quantity} > 0`),
  check("public_market_report_nonnegative_total", sql`${t.totalSeptims} >= 0`),
  index("public_market_reports_queue_idx").on(t.status, t.createdAt),
  index("public_market_reports_item_time_idx").on(t.itemId, t.locationType, t.createdAt),
  index("public_market_reports_submitter_idx").on(t.submittedBy, t.createdAt)
]);

export const approvals = pgTable("approvals", {
  id: uuid("id").defaultRandom().primaryKey(), storeId: uuid("store_id").references(() => stores.id), targetType: approvalTarget("target_type").notNull(), targetId: uuid("target_id").notNull(), decision: approvalDecision("decision").notNull().default("pending"),
  requestedBy: uuid("requested_by").notNull().references(() => users.id), reviewedBy: uuid("reviewed_by").references(() => users.id), note: text("note"), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), reviewedAt: timestamp("reviewed_at", { withTimezone: true })
}, (t) => [uniqueIndex("approvals_target_unique").on(t.targetType, t.targetId), index("approvals_queue_idx").on(t.storeId, t.decision, t.createdAt)]);

export const officialPriceRules = pgTable("official_price_rules", {
  id: uuid("id").defaultRandom().primaryKey(), storeId: uuid("store_id").references(() => stores.id), itemId: uuid("item_id").notNull().references(() => catalogItems.id), side: marketSide("side").notNull(),
  minimumSeptims: integer("minimum_septims").notNull(), maximumSeptims: integer("maximum_septims").notNull(), quantity: integer("quantity").notNull().default(1), maximumQuantity: integer("maximum_quantity").notNull().default(1), effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(), effectiveTo: timestamp("effective_to", { withTimezone: true }), sourceLabel: varchar("source_label", { length: 180 }).notNull(), provenanceUrl: text("provenance_url"), createdBy: uuid("created_by").references(() => users.id), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => [
  check("price_rule_range", sql`${t.minimumSeptims} >= 0 and ${t.maximumSeptims} >= ${t.minimumSeptims}`),
  check("price_rule_quantity", sql`${t.quantity} > 0 and ${t.maximumQuantity} >= ${t.quantity}`),
  index("official_price_lookup_idx").on(t.itemId, t.side, t.effectiveFrom),
  uniqueIndex("official_price_rule_identity_unique").on(t.storeId, t.itemId, t.side, t.effectiveFrom, t.sourceLabel)
]);

export const derivedSignals = pgTable("derived_signals", {
  id: uuid("id").defaultRandom().primaryKey(), itemId: uuid("item_id").notNull().references(() => catalogItems.id), side: marketSide("side").notNull(), audience: varchar("audience", { length: 16 }).notNull(),
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull(), median: numeric("median", { precision: 14, scale: 4 }), lowerQuartile: numeric("lower_quartile", { precision: 14, scale: 4 }), upperQuartile: numeric("upper_quartile", { precision: 14, scale: 4 }),
  signalCount: integer("signal_count").notNull(), storeCount: integer("store_count").notNull(), newestEvidenceAt: timestamp("newest_evidence_at", { withTimezone: true }), confidence: numeric("confidence", { precision: 5, scale: 4 }).notNull(), sourceCutoffAt: timestamp("source_cutoff_at", { withTimezone: true })
}, (t) => [check("signal_audience", sql`${t.audience} in ('private', 'public')`), index("derived_signals_lookup_idx").on(t.itemId, t.side, t.audience, t.computedAt)]);

export const delayedSnapshots = pgTable("delayed_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(), snapshotDate: timestamp("snapshot_date", { withTimezone: true }).notNull(), sourceCutoffAt: timestamp("source_cutoff_at", { withTimezone: true }).notNull(),
  catalogVersionId: uuid("catalog_version_id").references(() => catalogVersions.id), payload: jsonb("payload").notNull(), checksum: varchar("checksum", { length: 128 }).notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => [uniqueIndex("delayed_snapshot_date_unique").on(t.snapshotDate)]);

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").defaultRandom().primaryKey(), actorId: uuid("actor_id").references(() => users.id), storeId: uuid("store_id").references(() => stores.id), action: varchar("action", { length: 120 }).notNull(), entityType: varchar("entity_type", { length: 80 }).notNull(), entityId: uuid("entity_id"), before: jsonb("before"), after: jsonb("after"), occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => [index("audit_entity_idx").on(t.entityType, t.entityId), index("audit_store_time_idx").on(t.storeId, t.occurredAt)]);

export const jobs = pgTable("jobs", {
  id: uuid("id").defaultRandom().primaryKey(), kind: varchar("kind", { length: 100 }).notNull(), payload: jsonb("payload").notNull().default({}), status: jobStatus("status").notNull().default("queued"), attempts: integer("attempts").notNull().default(0), maxAttempts: integer("max_attempts").notNull().default(5), runAfter: timestamp("run_after", { withTimezone: true }).notNull().defaultNow(), lockedAt: timestamp("locked_at", { withTimezone: true }), lockedBy: varchar("locked_by", { length: 120 }), lastError: text("last_error"), completedAt: timestamp("completed_at", { withTimezone: true }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => [check("jobs_attempts_bounds", sql`${t.attempts} >= 0 and ${t.maxAttempts} > 0`), index("jobs_claim_idx").on(t.status, t.runAfter)]);

export const storesRelations = relations(stores, ({ many, one }) => ({ owner: one(users, { fields: [stores.ownerId], references: [users.id] }), memberships: many(memberships), receipts: many(receipts) }));
export const usersRelations = relations(users, ({ many }) => ({ memberships: many(memberships), accounts: many(accounts), sessions: many(sessions) }));
export const membershipsRelations = relations(memberships, ({ one }) => ({ store: one(stores, { fields: [memberships.storeId], references: [stores.id] }), user: one(users, { fields: [memberships.userId], references: [users.id] }) }));
export const receiptsRelations = relations(receipts, ({ one, many }) => ({ store: one(stores, { fields: [receipts.storeId], references: [stores.id] }), lines: many(receiptLines), movements: many(stockMovements) }));
export const receiptLinesRelations = relations(receiptLines, ({ one }) => ({ receipt: one(receipts, { fields: [receiptLines.receiptId], references: [receipts.id] }), item: one(catalogItems, { fields: [receiptLines.itemId], references: [catalogItems.id] }) }));
