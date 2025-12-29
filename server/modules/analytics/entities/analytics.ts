
import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "../../users/entities/users";

// Note: This module will use savedReports table from reports module
// with reportType = 'analytics' for saved analytical reports
// Additional analytics-specific tables can be added here as needed

// Placeholder for future analytics-specific tables
// For now, analytics will use the savedReports table with reportType='analytics'
