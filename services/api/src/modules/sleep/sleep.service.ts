import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "../../config";
import { AppError } from "../../utils/AppError";
import { SleepLog } from "./sleep.validation";

export class SleepService {
    private supabase: SupabaseClient;

    constructor() {
        this.supabase = createClient(
            config.supabase.url!,
            config.supabase.serviceRoleKey!,
        );
    }

    async getHistory(userId: string, limit: number = 30) {
        const { data, error } = await this.supabase
            .from("sleep_data")
            .select("*")
            .eq("user_id", userId)
            .order("date", { ascending: false })
            .limit(limit);

        if (error) {
            throw AppError.internal(
                `Failed to fetch sleep history: ${error.message}`,
            );
        }

        return data;
    }

    async saveLog(sleepLog: SleepLog) {
        const { data, error } = await this.supabase
            .from("sleep_data")
            .upsert(sleepLog, { onConflict: "user_id,date" })
            .select()
            .single();

        if (error) {
            throw AppError.internal(
                `Failed to save sleep log: ${error.message}`,
            );
        }

        return data;
    }

    async getLogByDate(userId: string, date: string) {
        const { data, error } = await this.supabase
            .from("sleep_data")
            .select("*")
            .eq("user_id", userId)
            .eq("date", date)
            .single();

        if (error && error.code !== "PGRST116") {
            throw AppError.internal(
                `Failed to fetch sleep log: ${error.message}`,
            );
        }

        return data || null;
    }

    async deleteLog(userId: string, date: string) {
        const { error } = await this.supabase
            .from("sleep_data")
            .delete()
            .eq("user_id", userId)
            .eq("date", date);

        if (error) {
            throw AppError.internal(
                `Failed to delete sleep log: ${error.message}`,
            );
        }

        return true;
    }
}

export const sleepService = new SleepService();
