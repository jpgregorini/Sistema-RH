"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cpfMask } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import type { PublicRegistration } from "@/types";

const PUBLIC_FIELDS = [
  "name", "cpf", "pix_key", "date_of_birth", "residencia", "local_nascimento",
  "pais_nacionalidade", "estado_civil", "filiacao_pai", "filiacao_mae",
  "orgao_emissor", "grau_instrucao", "sexo", "cor", "deficiencia",
  "telefone_residencial", "telefone_celular",
] as const;

export default function PublicRegistrationPage() {
  const params = useParams();
  const token = params.token as string;

  const { data, isLoading, isError } = useQuery<PublicRegistration>({
    queryKey: ["public-registration", token],
    queryFn: () => api.get(`/api/public/employee-registration/${token}`),
    retry: false,
  });

  const [form, setForm] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const set = (k: string) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (data) {
      const o: Record<string, string> = {};
      for (const k of PUBLIC_FIELDS) {
        const v = data.fields[k];
        o[k] = v === null || v === undefined ? "" : String(v);
      }
      if (!o.pais_nacionalidade) o.pais_nacionalidade = "BRASIL";
      setForm(o);
      if (data.submitted_at) setDone(true);
    }
  }, [data]);

  const submit = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {};
      for (const k of PUBLIC_FIELDS) {
        const v = form[k]?.trim();
        body[k] = v ? v : null;
      }
      return api.put(`/api/public/employee-registration/${token}`, body);
    },
    onSuccess: () => {
      setDone(true);
      toast.success("Dados enviados com sucesso!");
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onError: () => toast.error("Erro ao enviar. Tente novamente."),
  });

  const required = (k: string) => form[k]?.trim();

  const validate = () => {
    const missing: string[] = [];
    const checks: [string, string][] = [
      ["name", "Nome"],
      ["cpf", "CPF"],
      ["residencia", "Residência"],
      ["date_of_birth", "Data de nascimento"],
      ["local_nascimento", "Local de nascimento"],
      ["pais_nacionalidade", "País de nacionalidade"],
      ["estado_civil", "Estado civil"],
      ["filiacao_pai", "Filiação (pai)"],
      ["filiacao_mae", "Filiação (mãe)"],
      ["orgao_emissor", "Órgão emissor"],
      ["grau_instrucao", "Grau de instrução"],
      ["sexo", "Sexo"],
      ["cor", "Cor"],
      ["deficiencia", "Deficiência"],
      ["pix_key", "Chave PIX"],
    ];
    for (const [k, label] of checks) if (!required(k)) missing.push(label);
    if (!required("telefone_residencial") && !required("telefone_celular"))
      missing.push("Telefone (fixo ou celular)");
    return missing;
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-blue-600" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <h1 className="text-lg font-bold text-slate-900">Link inválido</h1>
            <p className="mt-2 text-sm text-slate-500">
              Este link de cadastro não é válido ou já não está disponível.
              Solicite um novo link ao RH.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">{data.employer.name}</p>
            <p className="text-xs text-slate-500">CNPJ: {data.employer.cnpj}</p>
          </div>
          <Image src="/logo.png" alt="Logo" width={120} height={36} className="h-8 w-auto object-contain" priority />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Ficha de Cadastro</h1>
          <p className="text-sm text-slate-500">
            Preencha seus dados pessoais para o registro de empregado.
          </p>
        </div>

        {done ? (
          <Card>
            <CardContent className="p-8 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
              <h2 className="mt-3 text-lg font-bold text-slate-900">
                Dados enviados!
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Obrigado. O RH foi notificado e dará sequência ao seu registro.
                Você pode fechar esta página.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setDone(false)}
              >
                Revisar / editar dados
              </Button>
            </CardContent>
          </Card>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const missing = validate();
              if (missing.length) {
                toast.error("Preencha: " + missing.join(", "));
                return;
              }
              submit.mutate();
            }}
          >
            <Card>
              <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
                <Field label="Nome Completo *" className="sm:col-span-2">
                  <Input value={form.name || ""} onChange={(e) => set("name")(e.target.value)} required />
                </Field>
                <Field label="CPF *">
                  <Input
                    value={form.cpf || ""}
                    onChange={(e) => set("cpf")(cpfMask(e.target.value))}
                    placeholder="000.000.000-00"
                  />
                </Field>
                <Field label="Chave PIX *">
                  <Input value={form.pix_key || ""} onChange={(e) => set("pix_key")(e.target.value)} />
                </Field>
                <Field label="Data de Nascimento *">
                  <Input type="date" value={form.date_of_birth || ""} onChange={(e) => set("date_of_birth")(e.target.value)} />
                </Field>
                <Field label="Local de Nascimento *">
                  <Input value={form.local_nascimento || ""} onChange={(e) => set("local_nascimento")(e.target.value)} placeholder="Cidade - UF" />
                </Field>
                <Field label="Residência (endereço completo) *" className="sm:col-span-2">
                  <Textarea rows={2} value={form.residencia || ""} onChange={(e) => set("residencia")(e.target.value)} />
                </Field>
                <Field label="País de Nacionalidade *">
                  <Input value={form.pais_nacionalidade || ""} onChange={(e) => set("pais_nacionalidade")(e.target.value)} />
                </Field>
                <Field label="Estado Civil *">
                  <Select value={form.estado_civil || ""} onValueChange={(v) => v && set("estado_civil")(v)}>
                    <SelectTrigger>
                      <span className="flex flex-1 text-left">{form.estado_civil || "Selecione"}</span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Solteiro">Solteiro(a)</SelectItem>
                      <SelectItem value="Casado">Casado(a)</SelectItem>
                      <SelectItem value="Divorciado">Divorciado(a)</SelectItem>
                      <SelectItem value="Viúvo">Viúvo(a)</SelectItem>
                      <SelectItem value="União Estável">União Estável</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Filiação - Pai *">
                  <Input value={form.filiacao_pai || ""} onChange={(e) => set("filiacao_pai")(e.target.value)} />
                </Field>
                <Field label="Filiação - Mãe *">
                  <Input value={form.filiacao_mae || ""} onChange={(e) => set("filiacao_mae")(e.target.value)} />
                </Field>
                <Field label="Sexo *">
                  <Select value={form.sexo || ""} onValueChange={(v) => v && set("sexo")(v)}>
                    <SelectTrigger>
                      <span className="flex flex-1 text-left">{form.sexo || "Selecione"}</span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Masculino">Masculino</SelectItem>
                      <SelectItem value="Feminino">Feminino</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Cor / Raça *">
                  <Input value={form.cor || ""} onChange={(e) => set("cor")(e.target.value)} />
                </Field>
                <Field label="Grau de Instrução *">
                  <Input value={form.grau_instrucao || ""} onChange={(e) => set("grau_instrucao")(e.target.value)} />
                </Field>
                <Field label="Deficiência *">
                  <Input value={form.deficiencia || ""} onChange={(e) => set("deficiencia")(e.target.value)} placeholder="Não / tipo" />
                </Field>
                <Field label="Órgão Emissor (RG) *">
                  <Input value={form.orgao_emissor || ""} onChange={(e) => set("orgao_emissor")(e.target.value)} placeholder="SSP/UF" />
                </Field>
                <Field label="Telefone Fixo">
                  <Input value={form.telefone_residencial || ""} onChange={(e) => set("telefone_residencial")(e.target.value)} />
                </Field>
                <Field label="Telefone Celular">
                  <Input value={form.telefone_celular || ""} onChange={(e) => set("telefone_celular")(e.target.value)} />
                </Field>
              </CardContent>
            </Card>

            <p className="mt-3 text-xs text-slate-500">
              Informe ao menos um telefone (fixo ou celular). Campos com * são obrigatórios.
            </p>

            <div className="mt-5">
              <Button type="submit" disabled={submit.isPending} className="w-full sm:w-auto">
                {submit.isPending ? "Enviando..." : "Enviar dados"}
              </Button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-2 ${className || ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
