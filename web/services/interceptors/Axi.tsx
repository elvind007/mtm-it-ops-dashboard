import axios from "axios";
import { toast } from "sonner";

/**
 * Shared HTTP client for the Express API.
 *
 * There is no auth layer in this project (the brief explicitly excludes one), so this
 * carries no token handling. The response interceptor surfaces failures as toasts and
 * re-throws, leaving retry/fallback decisions to the TanStack Query hook that made the
 * call rather than redirecting the whole app.
 */
const Axi = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api",
    timeout: 30_000,
    headers: {
        "Content-Type": "application/json",
    },
});

Axi.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;
        const message =
            error.response?.data?.error ??
            error.response?.data?.message ??
            error.message ??
            "Request failed";

        // Network-level failure: the API container is usually just not up yet.
        if (!error.response) {
            toast.error("Cannot reach the API", {
                description: "Is the api service running?",
            });
        } else if (status >= 500) {
            toast.error("Server error", { description: message });
        }

        return Promise.reject(error);
    },
);

export default Axi;
