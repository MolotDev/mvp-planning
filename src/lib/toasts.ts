import toast from "react-hot-toast";
import { DICTIONARY } from "@/constants/dictionary";

const duration = 5000;

export function notifySuccess(message: string) {
  toast.success(message, {
    duration,
    position: "bottom-right",
    style: {
      background: "#72C040",
      color: "#FFFFFF",
    },
  });
}

export function notifyError(message: string) {
  toast.error(message, {
    duration,
    position: "bottom-right",
    style: {
      background: "#D92D20",
      color: "#FFFFFF",
    },
  });
}

export function notifyWarning(message: string) {
  toast(message, {
    duration,
    position: "bottom-right",
    style: {
      background: "#F97316",
      color: "#FFFFFF",
    },
  });
}

export function notifyOperationError() {
  notifyError(DICTIONARY.common.error);
}
