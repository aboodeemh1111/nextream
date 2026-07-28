// Keep a single authenticated client for the whole admin app.
// Re-export so uploadClient and anything else importing @/lib/axios
// cannot drift from AuthContext's token storage again.
export { default } from "@/services/api";
