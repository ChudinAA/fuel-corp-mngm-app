CREATE TABLE "aircraft_refueling" (
	"id" serial PRIMARY KEY NOT NULL,
	"refueling_date" date NOT NULL,
	"product_type" text NOT NULL,
	"aircraft_number" text,
	"order_number" text,
	"supplier_id" integer NOT NULL,
	"basis" text,
	"buyer_id" integer NOT NULL,
	"quantity_liters" numeric(15, 2),
	"density" numeric(6, 4),
	"quantity_kg" numeric(15, 2) NOT NULL,
	"purchase_price" numeric(12, 4),
	"purchase_price_id" integer,
	"sale_price" numeric(12, 4),
	"sale_price_id" integer,
	"purchase_amount" numeric(15, 2),
	"sale_amount" numeric(15, 2),
	"profit" numeric(15, 2),
	"cumulative_profit" numeric(15, 2),
	"contract_number" text,
	"notes" text,
	"is_approx_volume" boolean DEFAULT false,
	"warehouse_status" text,
	"price_status" text,
	"created_at" timestamp DEFAULT now(),
	"created_by_id" integer
);
--> statement-breakpoint
CREATE TABLE "delivery_cost" (
	"id" serial PRIMARY KEY NOT NULL,
	"carrier_id" integer NOT NULL,
	"basis" text NOT NULL,
	"delivery_location_id" integer NOT NULL,
	"tariff" numeric(12, 4) NOT NULL,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "directory_logistics" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"carrier_id" integer,
	"storage_cost" numeric(12, 2),
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "directory_refueling" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"basis" text,
	"refueling_service_price" numeric(12, 2),
	"pvkj_price" numeric(12, 2),
	"agent_fee" numeric(12, 2),
	"storage_price" numeric(12, 2),
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "directory_wholesale" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"basis" text,
	"inn" text,
	"contract_number" text,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "exchange" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_date" date NOT NULL,
	"deal_number" text,
	"counterparty" text NOT NULL,
	"product_type" text NOT NULL,
	"quantity_kg" numeric(15, 2) NOT NULL,
	"price_per_kg" numeric(12, 4) NOT NULL,
	"total_amount" numeric(15, 2) NOT NULL,
	"warehouse_id" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"created_by_id" integer
);
--> statement-breakpoint
CREATE TABLE "movement" (
	"id" serial PRIMARY KEY NOT NULL,
	"movement_date" date NOT NULL,
	"movement_type" text NOT NULL,
	"product_type" text NOT NULL,
	"supplier_id" integer,
	"from_warehouse_id" integer,
	"to_warehouse_id" integer NOT NULL,
	"quantity_liters" numeric(15, 2),
	"density" numeric(6, 4),
	"quantity_kg" numeric(15, 2) NOT NULL,
	"purchase_price" numeric(12, 4),
	"delivery_price" numeric(12, 4),
	"delivery_cost" numeric(15, 2),
	"total_cost" numeric(15, 2),
	"cost_per_kg" numeric(12, 4),
	"carrier_id" integer,
	"vehicle_number" text,
	"trailer_number" text,
	"driver_name" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"created_by_id" integer
);
--> statement-breakpoint
CREATE TABLE "opt" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_date" date NOT NULL,
	"supplier_id" integer NOT NULL,
	"buyer_id" integer NOT NULL,
	"basis" text,
	"quantity_liters" numeric(15, 2),
	"density" numeric(6, 4),
	"quantity_kg" numeric(15, 2) NOT NULL,
	"purchase_price" numeric(12, 4),
	"purchase_price_id" integer,
	"sale_price" numeric(12, 4),
	"sale_price_id" integer,
	"purchase_amount" numeric(15, 2),
	"sale_amount" numeric(15, 2),
	"carrier_id" integer,
	"delivery_location_id" integer,
	"delivery_tariff" numeric(12, 4),
	"delivery_cost" numeric(15, 2),
	"profit" numeric(15, 2),
	"cumulative_profit" numeric(15, 2),
	"vehicle_number" text,
	"trailer_number" text,
	"driver_name" text,
	"contract_number" text,
	"notes" text,
	"is_approx_volume" boolean DEFAULT false,
	"warehouse_status" text,
	"price_status" text,
	"created_at" timestamp DEFAULT now(),
	"created_by_id" integer
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"module" text NOT NULL,
	"action" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_type" text NOT NULL,
	"counterparty_id" integer NOT NULL,
	"counterparty_type" text NOT NULL,
	"counterparty_role" text NOT NULL,
	"basis" text NOT NULL,
	"price_values" text[],
	"volume" numeric(15, 2),
	"date_from" date NOT NULL,
	"date_to" date NOT NULL,
	"contract_number" text,
	"contract_appendix" text,
	"sold_volume" numeric(15, 2) DEFAULT '0',
	"date_check_warning" text,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"role_id" integer NOT NULL,
	"permission_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"permissions" text[],
	"is_default" boolean DEFAULT false,
	"is_system" boolean DEFAULT false,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"patronymic" text,
	"role_id" integer,
	"is_active" boolean DEFAULT true,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "warehouse_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"warehouse_id" integer NOT NULL,
	"transaction_date" date NOT NULL,
	"transaction_type" text NOT NULL,
	"quantity" numeric(15, 2) NOT NULL,
	"price" numeric(12, 4),
	"total_amount" numeric(15, 2),
	"source_type" text,
	"source_id" integer,
	"balance_after" numeric(15, 2),
	"average_cost_after" numeric(12, 4)
);
--> statement-breakpoint
CREATE TABLE "warehouses" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"basis" text,
	"current_balance" numeric(15, 2) DEFAULT '0',
	"average_cost" numeric(12, 4) DEFAULT '0',
	"monthly_allocation" numeric(15, 2),
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
ALTER TABLE "aircraft_refueling" ADD CONSTRAINT "aircraft_refueling_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange" ADD CONSTRAINT "exchange_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange" ADD CONSTRAINT "exchange_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movement" ADD CONSTRAINT "movement_from_warehouse_id_warehouses_id_fk" FOREIGN KEY ("from_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movement" ADD CONSTRAINT "movement_to_warehouse_id_warehouses_id_fk" FOREIGN KEY ("to_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movement" ADD CONSTRAINT "movement_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opt" ADD CONSTRAINT "opt_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_transactions" ADD CONSTRAINT "warehouse_transactions_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;