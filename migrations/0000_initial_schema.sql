CREATE TABLE "bases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"base_type" text NOT NULL,
	"location" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp(6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"role_id" uuid,
	"is_active" boolean DEFAULT true,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	"updated_by_id" uuid,
	"deleted_at" timestamp,
	"deleted_by_id" uuid,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "movement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"movement_date" timestamp NOT NULL,
	"movement_type" text NOT NULL,
	"product_type" text NOT NULL,
	"supplier_id" uuid,
	"from_warehouse_id" uuid,
	"to_warehouse_id" uuid NOT NULL,
	"quantity_liters" numeric(15, 2),
	"density" numeric(6, 4),
	"quantity_kg" numeric(15, 2) NOT NULL,
	"purchase_price" numeric(12, 4),
	"purchase_price_id" uuid,
	"purchase_price_index" integer DEFAULT 0,
	"delivery_price" numeric(12, 4),
	"delivery_cost" numeric(15, 2),
	"total_cost" numeric(15, 2),
	"cost_per_kg" numeric(12, 4),
	"carrier_id" uuid,
	"basis" text,
	"vehicle_number" text,
	"trailer_number" text,
	"driver_name" text,
	"notes" text,
	"transaction_id" uuid,
	"source_transaction_id" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "aircraft_refueling" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"refueling_date" timestamp NOT NULL,
	"product_type" text NOT NULL,
	"aircraft_number" text,
	"order_number" text,
	"supplier_id" uuid NOT NULL,
	"basis" text,
	"buyer_id" uuid NOT NULL,
	"warehouse_id" uuid,
	"transaction_id" uuid,
	"quantity_liters" numeric(15, 2),
	"density" numeric(6, 4),
	"quantity_kg" numeric(15, 2) NOT NULL,
	"purchase_price" numeric(12, 4),
	"purchase_price_id" uuid,
	"purchase_price_index" integer DEFAULT 0,
	"sale_price" numeric(12, 4),
	"sale_price_id" uuid,
	"sale_price_index" integer DEFAULT 0,
	"purchase_amount" numeric(15, 2),
	"sale_amount" numeric(15, 2),
	"profit" numeric(15, 2),
	"contract_number" text,
	"notes" text,
	"is_approx_volume" boolean DEFAULT false,
	"purchase_price_modified" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp,
	"deleted_by_id" uuid,
	"is_draft" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_id" uuid NOT NULL,
	"buyer_id" uuid NOT NULL,
	"warehouse_id" uuid,
	"transaction_id" uuid,
	"deal_date" timestamp NOT NULL,
	"basis" text,
	"quantity_liters" numeric(15, 2),
	"density" numeric(6, 4),
	"quantity_kg" numeric(15, 2) NOT NULL,
	"purchase_price" numeric(12, 4),
	"purchase_price_id" uuid,
	"purchase_price_index" integer DEFAULT 0,
	"sale_price" numeric(12, 4),
	"sale_price_id" uuid,
	"sale_price_index" integer DEFAULT 0,
	"purchase_amount" numeric(15, 2),
	"sale_amount" numeric(15, 2),
	"carrier_id" uuid,
	"delivery_location_id" uuid,
	"delivery_tariff" numeric(12, 4),
	"delivery_cost" numeric(15, 2),
	"profit" numeric(15, 2),
	"contract_number" text,
	"notes" text,
	"is_approx_volume" boolean DEFAULT false,
	"purchase_price_modified" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp,
	"deleted_by_id" uuid,
	"is_draft" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exchange" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_date" timestamp NOT NULL,
	"deal_number" text,
	"counterparty" text NOT NULL,
	"product_type" text NOT NULL,
	"quantity_kg" numeric(15, 2) NOT NULL,
	"price_per_kg" numeric(12, 4) NOT NULL,
	"total_amount" numeric(15, 2) NOT NULL,
	"warehouse_id" uuid,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "warehouse_bases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"base_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "warehouse_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"transaction_type" text NOT NULL,
	"product_type" text DEFAULT 'kerosene',
	"quantity" numeric(15, 2) NOT NULL,
	"source_type" text,
	"source_id" uuid,
	"balance_before" numeric(15, 2),
	"balance_after" numeric(15, 2),
	"average_cost_before" numeric(12, 4),
	"average_cost_after" numeric(12, 4),
	"sum" numeric(15, 2),
	"price" numeric(12, 4),
	"transaction_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "warehouses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"supplier_id" uuid,
	"current_balance" numeric(15, 2) DEFAULT '0',
	"average_cost" numeric(12, 4) DEFAULT '0',
	"pvkj_balance" numeric(15, 2) DEFAULT '0',
	"pvkj_average_cost" numeric(12, 4) DEFAULT '0',
	"storage_cost" numeric(12, 2),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "supplier_bases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_id" uuid NOT NULL,
	"base_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"service_price" numeric(12, 2),
	"pvkj_price" numeric(12, 2),
	"agent_fee" numeric(12, 2),
	"is_warehouse" boolean DEFAULT false,
	"warehouse_id" uuid,
	"storage_cost" numeric(12, 2),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"inn" text,
	"contract_number" text,
	"contact_person" text,
	"phone" text,
	"email" text,
	"module" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "delivery_cost" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"carrier_id" uuid NOT NULL,
	"from_entity_type" text NOT NULL,
	"from_entity_id" uuid NOT NULL,
	"from_location" text NOT NULL,
	"to_entity_type" text NOT NULL,
	"to_entity_id" uuid NOT NULL,
	"to_location" text NOT NULL,
	"cost_per_kg" numeric(12, 4) NOT NULL,
	"distance" numeric(10, 2),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "logistics_carriers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"inn" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "logistics_delivery_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"notes" text,
	"base_id" uuid,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "logistics_drivers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"carrier_id" uuid,
	"full_name" text NOT NULL,
	"phone" text,
	"license_number" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "logistics_trailers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"carrier_id" uuid,
	"reg_number" text NOT NULL,
	"capacity_kg" numeric(12, 2),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "logistics_vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"carrier_id" uuid,
	"reg_number" text NOT NULL,
	"model" text,
	"capacity_kg" numeric(12, 2),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_type" text NOT NULL,
	"counterparty_id" uuid NOT NULL,
	"counterparty_type" text NOT NULL,
	"counterparty_role" text NOT NULL,
	"basis" text NOT NULL,
	"price_values" text[],
	"volume" numeric(15, 2),
	"date_from" date NOT NULL,
	"date_to" date NOT NULL,
	"contract_number" text,
	"contract_appendix" text,
	"notes" text,
	"sold_volume" numeric(15, 2) DEFAULT '0',
	"date_check_warning" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"permissions" text[],
	"is_default" boolean DEFAULT false,
	"is_system" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp,
	"deleted_by_id" uuid,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"operation" text NOT NULL,
	"old_data" jsonb,
	"new_data" jsonb,
	"changed_fields" text[],
	"user_id" uuid,
	"user_name" text,
	"user_email" text,
	"ip_address" text,
	"user_agent" text,
	"rolled_back_at" timestamp,
	"rolled_back_by_id" uuid,
	"entity_deleted" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cashflow_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_date" timestamp NOT NULL,
	"category" text NOT NULL,
	"subcategory" text,
	"amount" numeric(15, 2) NOT NULL,
	"currency" text DEFAULT 'RUB' NOT NULL,
	"description" text,
	"counterparty" text,
	"payment_method" text,
	"reference_type" text,
	"reference_id" uuid,
	"is_planned" boolean DEFAULT false,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "payment_calendar" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"due_date" date NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"amount" numeric(15, 2) NOT NULL,
	"currency" text DEFAULT 'RUB' NOT NULL,
	"category" text NOT NULL,
	"counterparty" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"paid_date" date,
	"paid_amount" numeric(15, 2),
	"reference_type" text,
	"reference_id" uuid,
	"is_recurring" boolean DEFAULT false,
	"recurring_pattern" jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "price_calculations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"product_type" text NOT NULL,
	"purchase_price" numeric(15, 2),
	"delivery_cost" numeric(15, 2),
	"storage_cost" numeric(15, 2),
	"service_fee" numeric(15, 2),
	"agent_fee" numeric(15, 2),
	"other_costs" numeric(15, 2),
	"markup_type" text DEFAULT 'percentage',
	"markup_value" numeric(15, 2),
	"total_cost" numeric(15, 2),
	"selling_price" numeric(15, 2),
	"margin" numeric(15, 2),
	"margin_percentage" numeric(5, 2),
	"is_template" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"deleted_at" timestamp,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "saved_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_type" text NOT NULL,
	"report_name" text NOT NULL,
	"description" text,
	"filters" jsonb NOT NULL,
	"columns" jsonb,
	"chart_config" jsonb,
	"is_public" text DEFAULT 'false' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	"created_by_id" uuid NOT NULL,
	"updated_by_id" uuid,
	"deleted_at" timestamp,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "registry_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_name" text NOT NULL,
	"template_type" text NOT NULL,
	"customer_type" text,
	"structure" jsonb NOT NULL,
	"is_active" text DEFAULT 'true' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	"created_by_id" uuid NOT NULL,
	"updated_by_id" uuid,
	"deleted_at" timestamp,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "monthly_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_month" timestamp NOT NULL,
	"plan_type" text NOT NULL,
	"base_id" uuid,
	"product_type" text,
	"planned_volume" text,
	"planned_revenue" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	"created_by_id" uuid NOT NULL,
	"updated_by_id" uuid,
	"deleted_at" timestamp,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "government_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_number" text NOT NULL,
	"contract_name" text NOT NULL,
	"customer_id" uuid,
	"contract_date" timestamp NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"total_amount" text,
	"current_amount" text,
	"remaining_amount" text,
	"product_type" text,
	"planned_volume" text,
	"actual_volume" text,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	"created_by_id" uuid NOT NULL,
	"updated_by_id" uuid,
	"deleted_at" timestamp,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "budget_income_expense" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"budget_month" timestamp NOT NULL,
	"sales_volume" text,
	"sales_revenue" text,
	"marginality" text,
	"operating_expenses" text,
	"personnel_expenses" text,
	"logistics_expenses" text,
	"other_expenses" text,
	"total_expenses" text,
	"net_profit" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	"created_by_id" uuid NOT NULL,
	"updated_by_id" uuid,
	"deleted_at" timestamp,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "management_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_name" text NOT NULL,
	"description" text,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"report_data" jsonb NOT NULL,
	"visualization_config" jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	"created_by_id" uuid NOT NULL,
	"updated_by_id" uuid,
	"deleted_at" timestamp,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "export_configurations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"module_name" text NOT NULL,
	"config_name" text NOT NULL,
	"selected_columns" jsonb NOT NULL,
	"filters" jsonb,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "dashboard_configurations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"is_default" boolean DEFAULT false,
	"layout" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"widgets" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "dashboard_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"role_id" uuid,
	"layout" jsonb NOT NULL,
	"widgets" jsonb NOT NULL,
	"is_system" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "widget_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"widget_key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"default_width" integer DEFAULT 4 NOT NULL,
	"default_height" integer DEFAULT 2 NOT NULL,
	"min_width" integer DEFAULT 2 NOT NULL,
	"min_height" integer DEFAULT 1 NOT NULL,
	"required_permissions" jsonb,
	"config_schema" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	CONSTRAINT "widget_definitions_widget_key_unique" UNIQUE("widget_key")
);
--> statement-breakpoint
ALTER TABLE "bases" ADD CONSTRAINT "bases_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bases" ADD CONSTRAINT "bases_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bases" ADD CONSTRAINT "bases_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movement" ADD CONSTRAINT "movement_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movement" ADD CONSTRAINT "movement_from_warehouse_id_warehouses_id_fk" FOREIGN KEY ("from_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movement" ADD CONSTRAINT "movement_to_warehouse_id_warehouses_id_fk" FOREIGN KEY ("to_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movement" ADD CONSTRAINT "movement_purchase_price_id_prices_id_fk" FOREIGN KEY ("purchase_price_id") REFERENCES "public"."prices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movement" ADD CONSTRAINT "movement_carrier_id_logistics_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."logistics_carriers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movement" ADD CONSTRAINT "movement_transaction_id_warehouse_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."warehouse_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movement" ADD CONSTRAINT "movement_source_transaction_id_warehouse_transactions_id_fk" FOREIGN KEY ("source_transaction_id") REFERENCES "public"."warehouse_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movement" ADD CONSTRAINT "movement_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movement" ADD CONSTRAINT "movement_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movement" ADD CONSTRAINT "movement_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aircraft_refueling" ADD CONSTRAINT "aircraft_refueling_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aircraft_refueling" ADD CONSTRAINT "aircraft_refueling_buyer_id_customers_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aircraft_refueling" ADD CONSTRAINT "aircraft_refueling_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aircraft_refueling" ADD CONSTRAINT "aircraft_refueling_transaction_id_warehouse_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."warehouse_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aircraft_refueling" ADD CONSTRAINT "aircraft_refueling_purchase_price_id_prices_id_fk" FOREIGN KEY ("purchase_price_id") REFERENCES "public"."prices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aircraft_refueling" ADD CONSTRAINT "aircraft_refueling_sale_price_id_prices_id_fk" FOREIGN KEY ("sale_price_id") REFERENCES "public"."prices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aircraft_refueling" ADD CONSTRAINT "aircraft_refueling_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aircraft_refueling" ADD CONSTRAINT "aircraft_refueling_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aircraft_refueling" ADD CONSTRAINT "aircraft_refueling_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opt" ADD CONSTRAINT "opt_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opt" ADD CONSTRAINT "opt_buyer_id_customers_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opt" ADD CONSTRAINT "opt_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opt" ADD CONSTRAINT "opt_transaction_id_warehouse_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."warehouse_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opt" ADD CONSTRAINT "opt_purchase_price_id_prices_id_fk" FOREIGN KEY ("purchase_price_id") REFERENCES "public"."prices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opt" ADD CONSTRAINT "opt_sale_price_id_prices_id_fk" FOREIGN KEY ("sale_price_id") REFERENCES "public"."prices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opt" ADD CONSTRAINT "opt_carrier_id_logistics_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."logistics_carriers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opt" ADD CONSTRAINT "opt_delivery_location_id_logistics_delivery_locations_id_fk" FOREIGN KEY ("delivery_location_id") REFERENCES "public"."logistics_delivery_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opt" ADD CONSTRAINT "opt_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opt" ADD CONSTRAINT "opt_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opt" ADD CONSTRAINT "opt_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange" ADD CONSTRAINT "exchange_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange" ADD CONSTRAINT "exchange_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange" ADD CONSTRAINT "exchange_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange" ADD CONSTRAINT "exchange_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_bases" ADD CONSTRAINT "warehouse_bases_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_bases" ADD CONSTRAINT "warehouse_bases_base_id_bases_id_fk" FOREIGN KEY ("base_id") REFERENCES "public"."bases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_transactions" ADD CONSTRAINT "warehouse_transactions_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_transactions" ADD CONSTRAINT "warehouse_transactions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_transactions" ADD CONSTRAINT "warehouse_transactions_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_transactions" ADD CONSTRAINT "warehouse_transactions_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_bases" ADD CONSTRAINT "supplier_bases_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_bases" ADD CONSTRAINT "supplier_bases_base_id_bases_id_fk" FOREIGN KEY ("base_id") REFERENCES "public"."bases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_cost" ADD CONSTRAINT "delivery_cost_carrier_id_logistics_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."logistics_carriers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_cost" ADD CONSTRAINT "delivery_cost_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_cost" ADD CONSTRAINT "delivery_cost_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_cost" ADD CONSTRAINT "delivery_cost_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_carriers" ADD CONSTRAINT "logistics_carriers_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_carriers" ADD CONSTRAINT "logistics_carriers_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_carriers" ADD CONSTRAINT "logistics_carriers_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_delivery_locations" ADD CONSTRAINT "logistics_delivery_locations_base_id_bases_id_fk" FOREIGN KEY ("base_id") REFERENCES "public"."bases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_delivery_locations" ADD CONSTRAINT "logistics_delivery_locations_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_delivery_locations" ADD CONSTRAINT "logistics_delivery_locations_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_delivery_locations" ADD CONSTRAINT "logistics_delivery_locations_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_drivers" ADD CONSTRAINT "logistics_drivers_carrier_id_logistics_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."logistics_carriers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_drivers" ADD CONSTRAINT "logistics_drivers_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_drivers" ADD CONSTRAINT "logistics_drivers_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_drivers" ADD CONSTRAINT "logistics_drivers_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_trailers" ADD CONSTRAINT "logistics_trailers_carrier_id_logistics_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."logistics_carriers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_trailers" ADD CONSTRAINT "logistics_trailers_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_trailers" ADD CONSTRAINT "logistics_trailers_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_trailers" ADD CONSTRAINT "logistics_trailers_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_vehicles" ADD CONSTRAINT "logistics_vehicles_carrier_id_logistics_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."logistics_carriers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_vehicles" ADD CONSTRAINT "logistics_vehicles_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_vehicles" ADD CONSTRAINT "logistics_vehicles_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_vehicles" ADD CONSTRAINT "logistics_vehicles_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_rolled_back_by_id_users_id_fk" FOREIGN KEY ("rolled_back_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashflow_transactions" ADD CONSTRAINT "cashflow_transactions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashflow_transactions" ADD CONSTRAINT "cashflow_transactions_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashflow_transactions" ADD CONSTRAINT "cashflow_transactions_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_calendar" ADD CONSTRAINT "payment_calendar_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_calendar" ADD CONSTRAINT "payment_calendar_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_calendar" ADD CONSTRAINT "payment_calendar_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_calculations" ADD CONSTRAINT "price_calculations_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_calculations" ADD CONSTRAINT "price_calculations_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_calculations" ADD CONSTRAINT "price_calculations_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_reports" ADD CONSTRAINT "saved_reports_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_reports" ADD CONSTRAINT "saved_reports_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_reports" ADD CONSTRAINT "saved_reports_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registry_templates" ADD CONSTRAINT "registry_templates_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registry_templates" ADD CONSTRAINT "registry_templates_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registry_templates" ADD CONSTRAINT "registry_templates_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_plans" ADD CONSTRAINT "monthly_plans_base_id_bases_id_fk" FOREIGN KEY ("base_id") REFERENCES "public"."bases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_plans" ADD CONSTRAINT "monthly_plans_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_plans" ADD CONSTRAINT "monthly_plans_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_plans" ADD CONSTRAINT "monthly_plans_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "government_contracts" ADD CONSTRAINT "government_contracts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "government_contracts" ADD CONSTRAINT "government_contracts_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "government_contracts" ADD CONSTRAINT "government_contracts_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "government_contracts" ADD CONSTRAINT "government_contracts_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_income_expense" ADD CONSTRAINT "budget_income_expense_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_income_expense" ADD CONSTRAINT "budget_income_expense_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_income_expense" ADD CONSTRAINT "budget_income_expense_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "management_reports" ADD CONSTRAINT "management_reports_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "management_reports" ADD CONSTRAINT "management_reports_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "management_reports" ADD CONSTRAINT "management_reports_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_configurations" ADD CONSTRAINT "export_configurations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_configurations" ADD CONSTRAINT "dashboard_configurations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_templates" ADD CONSTRAINT "dashboard_templates_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_templates" ADD CONSTRAINT "dashboard_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bases_base_type_idx" ON "bases" USING btree ("base_type");--> statement-breakpoint
CREATE INDEX "bases_name_idx" ON "bases" USING btree ("name");--> statement-breakpoint
CREATE INDEX "bases_is_active_idx" ON "bases" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "movement_date_idx" ON "movement" USING btree ("movement_date");--> statement-breakpoint
CREATE INDEX "movement_created_at_idx" ON "movement" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "movement_type_idx" ON "movement" USING btree ("movement_type");--> statement-breakpoint
CREATE INDEX "movement_to_warehouse_idx" ON "movement" USING btree ("to_warehouse_id");--> statement-breakpoint
CREATE INDEX "movement_from_warehouse_idx" ON "movement" USING btree ("from_warehouse_id");--> statement-breakpoint
CREATE INDEX "movement_product_type_idx" ON "movement" USING btree ("product_type");--> statement-breakpoint
CREATE INDEX "aircraft_refueling_date_idx" ON "aircraft_refueling" USING btree ("refueling_date");--> statement-breakpoint
CREATE INDEX "aircraft_refueling_created_at_idx" ON "aircraft_refueling" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "aircraft_refueling_supplier_basis_idx" ON "aircraft_refueling" USING btree ("supplier_id","basis");--> statement-breakpoint
CREATE INDEX "aircraft_refueling_buyer_basis_idx" ON "aircraft_refueling" USING btree ("buyer_id","basis");--> statement-breakpoint
CREATE INDEX "aircraft_refueling_product_type_idx" ON "aircraft_refueling" USING btree ("product_type");--> statement-breakpoint
CREATE INDEX "aircraft_refueling_warehouse_idx" ON "aircraft_refueling" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "opt_deal_date_idx" ON "opt" USING btree ("deal_date");--> statement-breakpoint
CREATE INDEX "opt_created_at_idx" ON "opt" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "opt_supplier_basis_idx" ON "opt" USING btree ("supplier_id","basis");--> statement-breakpoint
CREATE INDEX "opt_buyer_basis_idx" ON "opt" USING btree ("buyer_id","basis");--> statement-breakpoint
CREATE INDEX "opt_warehouse_idx" ON "opt" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "exchange_deal_date_idx" ON "exchange" USING btree ("deal_date");--> statement-breakpoint
CREATE INDEX "exchange_warehouse_idx" ON "exchange" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "exchange_product_type_idx" ON "exchange" USING btree ("product_type");--> statement-breakpoint
CREATE INDEX "unique_warehouse_base_idx" ON "warehouse_bases" USING btree ("warehouse_id","base_id");--> statement-breakpoint
CREATE INDEX "warehouse_transactions_warehouse_id_idx" ON "warehouse_transactions" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "warehouse_transactions_created_at_idx" ON "warehouse_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "warehouse_transactions_source_idx" ON "warehouse_transactions" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "warehouse_transactions_warehouse_product_idx" ON "warehouse_transactions" USING btree ("warehouse_id","product_type");--> statement-breakpoint
CREATE INDEX "warehouse_transactions_warehouse_date_idx" ON "warehouse_transactions" USING btree ("warehouse_id","created_at");--> statement-breakpoint
CREATE INDEX "warehouses_name_idx" ON "warehouses" USING btree ("name");--> statement-breakpoint
CREATE INDEX "warehouses_is_active_idx" ON "warehouses" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "warehouses_supplier_idx" ON "warehouses" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "unique_supplier_base_idx" ON "supplier_bases" USING btree ("supplier_id","base_id");--> statement-breakpoint
CREATE INDEX "suppliers_name_idx" ON "suppliers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "suppliers_is_active_idx" ON "suppliers" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "suppliers_is_warehouse_idx" ON "suppliers" USING btree ("is_warehouse");--> statement-breakpoint
CREATE INDEX "customers_module_idx" ON "customers" USING btree ("module");--> statement-breakpoint
CREATE INDEX "customers_name_idx" ON "customers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "customers_is_active_idx" ON "customers" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "delivery_cost_carrier_idx" ON "delivery_cost" USING btree ("carrier_id");--> statement-breakpoint
CREATE INDEX "delivery_cost_from_entity_idx" ON "delivery_cost" USING btree ("from_entity_type","from_entity_id");--> statement-breakpoint
CREATE INDEX "delivery_cost_to_entity_idx" ON "delivery_cost" USING btree ("to_entity_type","to_entity_id");--> statement-breakpoint
CREATE INDEX "delivery_cost_is_active_idx" ON "delivery_cost" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "logistics_carriers_name_idx" ON "logistics_carriers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "logistics_carriers_is_active_idx" ON "logistics_carriers" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "logistics_delivery_locations_base_id_idx" ON "logistics_delivery_locations" USING btree ("base_id");--> statement-breakpoint
CREATE INDEX "logistics_vehicles_carrier_idx" ON "logistics_vehicles" USING btree ("carrier_id");--> statement-breakpoint
CREATE INDEX "logistics_vehicles_reg_number_idx" ON "logistics_vehicles" USING btree ("reg_number");--> statement-breakpoint
CREATE INDEX "logistics_vehicles_is_active_idx" ON "logistics_vehicles" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "prices_counterparty_role_type_idx" ON "prices" USING btree ("counterparty_role","counterparty_type");--> statement-breakpoint
CREATE INDEX "prices_counterparty_id_idx" ON "prices" USING btree ("counterparty_id");--> statement-breakpoint
CREATE INDEX "prices_date_range_idx" ON "prices" USING btree ("date_from","date_to");--> statement-breakpoint
CREATE INDEX "prices_is_active_idx" ON "prices" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "prices_basis_product_idx" ON "prices" USING btree ("basis","product_type");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_log_user_idx" ON "audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_log_operation_idx" ON "audit_log" USING btree ("operation");--> statement-breakpoint
CREATE INDEX "audit_log_entity_created_idx" ON "audit_log" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "cashflow_date_idx" ON "cashflow_transactions" USING btree ("transaction_date");--> statement-breakpoint
CREATE INDEX "cashflow_category_idx" ON "cashflow_transactions" USING btree ("category");--> statement-breakpoint
CREATE INDEX "cashflow_reference_idx" ON "cashflow_transactions" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE INDEX "payment_due_date_idx" ON "payment_calendar" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "payment_status_idx" ON "payment_calendar" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payment_category_idx" ON "payment_calendar" USING btree ("category");--> statement-breakpoint
CREATE INDEX "price_calc_product_type_idx" ON "price_calculations" USING btree ("product_type");--> statement-breakpoint
CREATE INDEX "price_calc_active_idx" ON "price_calculations" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "saved_reports_report_type_idx" ON "saved_reports" USING btree ("report_type");--> statement-breakpoint
CREATE INDEX "saved_reports_created_by_idx" ON "saved_reports" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "saved_reports_created_at_idx" ON "saved_reports" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "registry_templates_template_type_idx" ON "registry_templates" USING btree ("template_type");--> statement-breakpoint
CREATE INDEX "registry_templates_is_active_idx" ON "registry_templates" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "monthly_plans_plan_month_idx" ON "monthly_plans" USING btree ("plan_month");--> statement-breakpoint
CREATE INDEX "monthly_plans_plan_type_idx" ON "monthly_plans" USING btree ("plan_type");--> statement-breakpoint
CREATE INDEX "monthly_plans_base_id_idx" ON "monthly_plans" USING btree ("base_id");--> statement-breakpoint
CREATE INDEX "government_contracts_contract_number_idx" ON "government_contracts" USING btree ("contract_number");--> statement-breakpoint
CREATE INDEX "government_contracts_status_idx" ON "government_contracts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "government_contracts_start_date_idx" ON "government_contracts" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "government_contracts_end_date_idx" ON "government_contracts" USING btree ("end_date");--> statement-breakpoint
CREATE INDEX "budget_income_expense_budget_month_idx" ON "budget_income_expense" USING btree ("budget_month");--> statement-breakpoint
CREATE INDEX "management_reports_period_start_idx" ON "management_reports" USING btree ("period_start");--> statement-breakpoint
CREATE INDEX "management_reports_period_end_idx" ON "management_reports" USING btree ("period_end");--> statement-breakpoint
CREATE INDEX "management_reports_created_by_idx" ON "management_reports" USING btree ("created_by_id");