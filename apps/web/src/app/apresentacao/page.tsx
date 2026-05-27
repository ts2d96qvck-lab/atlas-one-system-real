import type { Metadata } from "next";
import { ApresentacaoClient } from "./apresentacao-client";

export const metadata: Metadata = {
  title: "Apresentacao Comercial — Atlas One",
  description: "Apresentacao comercial Atlas One — imprima ou salve como PDF"
};

export default function ApresentacaoPage() {
  return <ApresentacaoClient />;
}
