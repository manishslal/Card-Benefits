-- CreateTable
CREATE TABLE "lounge_airports" (
    "id" TEXT NOT NULL,
    "iata_code" VARCHAR(3) NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lounge_airports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lounge_terminals" (
    "id" TEXT NOT NULL,
    "airport_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_airside" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lounge_terminals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lounges" (
    "id" TEXT NOT NULL,
    "terminal_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "operator" TEXT,
    "location_details" TEXT,
    "operating_hours" JSONB,
    "amenities" JSONB,
    "is_restaurant_credit" BOOLEAN NOT NULL DEFAULT false,
    "may_deny_entry" BOOLEAN NOT NULL DEFAULT false,
    "last_verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lounges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lounge_access_methods" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "provider" TEXT,
    "grants_network_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lounge_access_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lounge_access_rules" (
    "id" TEXT NOT NULL,
    "lounge_id" TEXT NOT NULL,
    "access_method_id" TEXT NOT NULL,
    "guest_limit" INTEGER,
    "guest_fee" DECIMAL(10,2),
    "guest_conditions" TEXT,
    "entry_cost" DECIMAL(10,2),
    "time_limit_hours" INTEGER,
    "conditions" JSONB,
    "notes" TEXT,
    "last_verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lounge_access_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_lounge_access" (
    "id" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,
    "access_method_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_lounge_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lounge_scrape_runs" (
    "id" TEXT NOT NULL,
    "source_name" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "records_found" INTEGER,
    "records_upserted" INTEGER,
    "errors" JSONB,
    "status" TEXT NOT NULL,

    CONSTRAINT "lounge_scrape_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: lounge_airports
CREATE UNIQUE INDEX "lounge_airports_iata_code_key" ON "lounge_airports"("iata_code");

-- CreateIndex: lounge_terminals
CREATE INDEX "lounge_terminals_airport_id_idx" ON "lounge_terminals"("airport_id");

-- CreateIndex: lounges
CREATE INDEX "lounges_terminal_id_idx" ON "lounges"("terminal_id");
CREATE INDEX "lounges_operator_idx" ON "lounges"("operator");

-- CreateIndex: lounge_access_methods
CREATE INDEX "lounge_access_methods_category_idx" ON "lounge_access_methods"("category");
CREATE INDEX "lounge_access_methods_grants_network_id_idx" ON "lounge_access_methods"("grants_network_id");

-- CreateIndex: lounge_access_rules
CREATE INDEX "lounge_access_rules_lounge_id_idx" ON "lounge_access_rules"("lounge_id");
CREATE INDEX "lounge_access_rules_access_method_id_idx" ON "lounge_access_rules"("access_method_id");
CREATE UNIQUE INDEX "lounge_access_rules_lounge_id_access_method_id_key" ON "lounge_access_rules"("lounge_id", "access_method_id");

-- CreateIndex: card_lounge_access
CREATE INDEX "card_lounge_access_card_id_idx" ON "card_lounge_access"("card_id");
CREATE INDEX "card_lounge_access_access_method_id_idx" ON "card_lounge_access"("access_method_id");
CREATE UNIQUE INDEX "card_lounge_access_card_id_access_method_id_key" ON "card_lounge_access"("card_id", "access_method_id");

-- AddForeignKey: lounge_terminals → lounge_airports
ALTER TABLE "lounge_terminals" ADD CONSTRAINT "lounge_terminals_airport_id_fkey" FOREIGN KEY ("airport_id") REFERENCES "lounge_airports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: lounges → lounge_terminals
ALTER TABLE "lounges" ADD CONSTRAINT "lounges_terminal_id_fkey" FOREIGN KEY ("terminal_id") REFERENCES "lounge_terminals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: lounge_access_methods self-ref (network grant)
ALTER TABLE "lounge_access_methods" ADD CONSTRAINT "lounge_access_methods_grants_network_id_fkey" FOREIGN KEY ("grants_network_id") REFERENCES "lounge_access_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: lounge_access_rules → lounges
ALTER TABLE "lounge_access_rules" ADD CONSTRAINT "lounge_access_rules_lounge_id_fkey" FOREIGN KEY ("lounge_id") REFERENCES "lounges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: lounge_access_rules → lounge_access_methods
ALTER TABLE "lounge_access_rules" ADD CONSTRAINT "lounge_access_rules_access_method_id_fkey" FOREIGN KEY ("access_method_id") REFERENCES "lounge_access_methods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: card_lounge_access → MasterCard
ALTER TABLE "card_lounge_access" ADD CONSTRAINT "card_lounge_access_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "MasterCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: card_lounge_access → lounge_access_methods
ALTER TABLE "card_lounge_access" ADD CONSTRAINT "card_lounge_access_access_method_id_fkey" FOREIGN KEY ("access_method_id") REFERENCES "lounge_access_methods"("id") ON DELETE CASCADE ON UPDATE CASCADE;
