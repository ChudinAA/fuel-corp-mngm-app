
-- Add service price fields to refueling_providers
ALTER TABLE "refueling_providers" ADD COLUMN "service_price" numeric(12, 2);
ALTER TABLE "refueling_providers" ADD COLUMN "pvkj_price" numeric(12, 2);
ALTER TABLE "refueling_providers" ADD COLUMN "agent_fee" numeric(12, 2);
