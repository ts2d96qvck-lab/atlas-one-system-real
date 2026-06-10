import { toast } from "sonner";

/** Central in-app feedback API. Use instead of inline <p> messages. */
export const notify = {
  success(message: string, description?: string) {
    toast.success(message, { description });
  },
  error(message: string, description?: string) {
    toast.error(message, { description, duration: 5000 });
  },
  info(message: string, description?: string) {
    toast(message, { description });
  },
  loading(message: string) {
    return toast.loading(message);
  },
  dismiss(id?: string | number) {
    toast.dismiss(id);
  }
};
