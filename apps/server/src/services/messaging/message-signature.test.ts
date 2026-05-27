import { describe, expect, it } from "vitest";
import { applyOutgoingSignature, parseMessagingSettings } from "./message-signature.service";

describe("message signature", () => {
  it("preserves paragraphs when signature is disabled", () => {
    const settings = parseMessagingSettings({ messaging: { signaturePlacement: "disabled" } });
    const text = "Ola, tudo bem?\n\nAqui e o Joao.\n\nPodemos confirmar?";
    const result = applyOutgoingSignature(text, { id: "u1", name: "Joao", role: "agent" }, settings);
    expect(result.providerText).toBe(text);
    expect(result.signatureApplied).toBe(false);
  });

  it("prepends signature without destroying blank lines", () => {
    const settings = parseMessagingSettings({
      messaging: {
        showAgentNameToCustomer: true,
        signaturePlacement: "before",
        agentSignatureFormat: "Atendente {{agentName}}:"
      }
    });
    const text = "Linha 1\n\nLinha 2";
    const result = applyOutgoingSignature(text, { id: "u1", name: "Joao", role: "agent" }, settings);
    expect(result.providerText).toBe("Atendente Joao:\nLinha 1\n\nLinha 2");
  });
});
