"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase-browser";
import { cpfMask } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Driver, CompanyName } from "@/types";

const COMPANIES: CompanyName[] = ["Ascop", "Cooplider", "Alimex"];

interface DriverFormProps {
  driver?: Driver;
}

export function DriverForm({ driver }: DriverFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEditing = !!driver;

  const [name, setName] = useState(driver?.name || "");
  const [cpf, setCpf] = useState(driver?.cpf || "");
  const [dateOfBirth, setDateOfBirth] = useState(driver?.date_of_birth || "");
  const [phone, setPhone] = useState(driver?.phone || "");
  const [pixKey, setPixKey] = useState(driver?.pix_key || "");
  const [payday, setPayday] = useState(driver?.payday || 10);
  const [baseSalary, setBaseSalary] = useState(
    driver?.base_salary ? String(driver.base_salary) : ""
  );
  const [notes, setNotes] = useState(driver?.notes || "");

  const [commissions, setCommissions] = useState<
    Record<CompanyName, { enabled: boolean; pct: number }>
  >(() => {
    const defaults: Record<CompanyName, { enabled: boolean; pct: number }> = {
      Ascop: { enabled: false, pct: 0 },
      Cooplider: { enabled: false, pct: 0 },
      Alimex: { enabled: false, pct: 0 },
    };
    driver?.driver_company_commissions?.forEach((c) => {
      defaults[c.company] = { enabled: true, pct: c.commission_pct };
    });
    return defaults;
  });

  // File URLs
  const [photoUrl, setPhotoUrl] = useState(driver?.photo_url || "");
  const [contractUrl, setContractUrl] = useState(driver?.contract_file_url || "");
  const [insuranceUrl, setInsuranceUrl] = useState(driver?.life_insurance_url || "");
  const [certidaoUrl, setCertidaoUrl] = useState(driver?.certidao_negativa_url || "");

  // Benefits
  const [benefAlimentacao, setBenefAlimentacao] = useState(driver?.beneficio_alimentacao ? String(driver.beneficio_alimentacao) : "");
  const [benefTransporte, setBenefTransporte] = useState(driver?.beneficio_transporte ? String(driver.beneficio_transporte) : "");
  const [benefRefeicao, setBenefRefeicao] = useState(driver?.beneficio_refeicao ? String(driver.beneficio_refeicao) : "");

  const [aiLoading, setAiLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const comms = COMPANIES.filter((c) => commissions[c].enabled).map(
        (c) => ({
          company: c,
          commission_pct: commissions[c].pct,
        })
      );

      const body = {
        name,
        cpf,
        date_of_birth: dateOfBirth || null,
        phone: phone || null,
        pix_key: pixKey || null,
        payday,
        base_salary: baseSalary ? Number(baseSalary) : null,
        notes: notes || null,
        photo_url: photoUrl || null,
        contract_file_url: contractUrl || null,
        life_insurance_url: insuranceUrl || null,
        certidao_negativa_url: certidaoUrl || null,
        commissions: comms,
        beneficio_alimentacao: Number(benefAlimentacao) || 0,
        beneficio_transporte: Number(benefTransporte) || 0,
        beneficio_refeicao: Number(benefRefeicao) || 0,
      };

      if (isEditing) {
        return api.put(`/api/drivers/${driver.id}`, body);
      }
      return api.post("/api/drivers", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
      toast.success(
        isEditing
          ? "Motorista atualizado com sucesso."
          : "Motorista cadastrado com sucesso."
      );
      router.push("/motoristas");
    },
    onError: () => {
      toast.error("Erro ao salvar motorista.");
    },
  });

  const handleFileUpload = useCallback(
    async (file: File, bucket: string, onUrl: (url: string) => void) => {
      setUploading(true);
      const ext = file.name.split(".").pop();
      const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, file);

      if (error) {
        toast.error("Erro ao enviar arquivo.");
        setUploading(false);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(bucket).getPublicUrl(path);
      onUrl(publicUrl);
      setUploading(false);
      toast.success("Arquivo enviado.");
    },
    []
  );

  const handleAiExtract = async (file: File) => {
    setAiLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await api.upload<{
        name: string | null;
        cpf: string | null;
        date_of_birth: string | null;
        phone: string | null;
        error?: string;
      }>("/api/ai/extract-driver-info", formData);

      if (result.error) {
        toast.error(result.error);
      } else {
        if (result.name) setName(result.name);
        if (result.cpf) setCpf(result.cpf);
        if (result.date_of_birth) setDateOfBirth(result.date_of_birth);
        if (result.phone) setPhone(result.phone);
        toast.success("Dados extraídos do documento.");

        // Show which fields are still missing
        const missing = [];
        if (!result.name) missing.push("Nome");
        if (!result.cpf) missing.push("CPF");
        if (!result.date_of_birth) missing.push("Data de Nascimento");
        if (missing.length > 0) {
          toast.warning(`Campos não encontrados: ${missing.join(", ")}`);
        }
      }
    } catch {
      toast.error("Erro ao extrair dados do documento.");
    }
    setAiLoading(false);
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          {isEditing ? "Editar Motorista" : "Novo Motorista"}
        </h1>
        <p className="text-sm text-slate-500">
          {isEditing
            ? "Atualize as informações do motorista"
            : "Cadastre um novo motorista no sistema"}
        </p>
      </div>

      {!isEditing && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Preenchimento Automático
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-slate-500">
              Envie um documento (RG, CNH, etc.) para extrair os dados
              automaticamente.
            </p>
            <div className="flex items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600 transition-colors hover:border-blue-400 hover:text-blue-600">
                <Upload className="h-4 w-4" />
                {aiLoading ? "Analisando..." : "Enviar Documento"}
                <input
                  type="file"
                  className="hidden"
                  accept="image/*,.pdf"
                  disabled={aiLoading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleAiExtract(file);
                  }}
                />
              </label>
              {aiLoading && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
            </div>
          </CardContent>
        </Card>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          saveMutation.mutate();
        }}
      >
        <Tabs defaultValue="dados">
          <TabsList className="mb-4">
            <TabsTrigger value="dados">Dados Pessoais</TabsTrigger>
            <TabsTrigger value="beneficios">Benefícios</TabsTrigger>
            <TabsTrigger value="comissoes">Comissões</TabsTrigger>
            <TabsTrigger value="documentos">Documentos</TabsTrigger>
          </TabsList>

          <TabsContent value="dados">
            <Card>
              <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="name">Nome Completo *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF *</Label>
                  <Input
                    id="cpf"
                    value={cpf}
                    onChange={(e) => setCpf(cpfMask(e.target.value))}
                    placeholder="000.000.000-00"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dob">Data de Nascimento</Label>
                  <Input
                    id="dob"
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pix">Chave PIX</Label>
                  <Input
                    id="pix"
                    value={pixKey}
                    onChange={(e) => setPixKey(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payday">Dia de Pagamento *</Label>
                  <Input
                    id="payday"
                    type="number"
                    min={1}
                    max={31}
                    value={payday}
                    onChange={(e) => setPayday(Number(e.target.value))}
                    required
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="base_salary">Salário Mensal (R$)</Label>
                  <Input
                    id="base_salary"
                    type="number"
                    step="0.01"
                    min="0"
                    value={baseSalary}
                    onChange={(e) => setBaseSalary(e.target.value)}
                    placeholder="Opcional — preencha apenas se o motorista recebe salário fixo além da comissão"
                  />
                  <p className="text-xs text-slate-500">
                    Deixe em branco para motoristas que recebem somente por comissão.
                  </p>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="notes">Observações</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="beneficios">
            <Card>
              <CardContent className="space-y-4 p-6">
                <p className="text-sm text-slate-500">
                  Defina os valores do cartão de benefícios. O total do cartão é a soma das 3 categorias.
                </p>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="benef_alim">Alimentação (R$)</Label>
                    <Input
                      id="benef_alim"
                      type="number"
                      step="0.01"
                      min="0"
                      value={benefAlimentacao}
                      onChange={(e) => setBenefAlimentacao(e.target.value)}
                      placeholder="0,00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="benef_trans">Transporte (R$)</Label>
                    <Input
                      id="benef_trans"
                      type="number"
                      step="0.01"
                      min="0"
                      value={benefTransporte}
                      onChange={(e) => setBenefTransporte(e.target.value)}
                      placeholder="0,00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="benef_ref">Refeição (R$)</Label>
                    <Input
                      id="benef_ref"
                      type="number"
                      step="0.01"
                      min="0"
                      value={benefRefeicao}
                      onChange={(e) => setBenefRefeicao(e.target.value)}
                      placeholder="0,00"
                    />
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-sm font-medium text-slate-700">
                    Total do Cartão:{" "}
                    <span className="text-blue-600">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                        (Number(benefAlimentacao) || 0) + (Number(benefTransporte) || 0) + (Number(benefRefeicao) || 0)
                      )}
                    </span>
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="comissoes">
            <Card>
              <CardContent className="space-y-4 p-6">
                <p className="text-sm text-slate-500">
                  Selecione as empresas e defina a porcentagem de comissão para
                  cada uma.
                </p>
                {COMPANIES.map((company) => (
                  <div
                    key={company}
                    className="flex items-center gap-4 rounded-lg border p-4"
                  >
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={commissions[company].enabled}
                        onChange={(e) =>
                          setCommissions((prev) => ({
                            ...prev,
                            [company]: {
                              ...prev[company],
                              enabled: e.target.checked,
                            },
                          }))
                        }
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      <span className="font-medium">{company}</span>
                    </label>
                    {commissions[company].enabled && (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          className="w-24"
                          value={commissions[company].pct}
                          onChange={(e) =>
                            setCommissions((prev) => ({
                              ...prev,
                              [company]: {
                                ...prev[company],
                                pct: Number(e.target.value),
                              },
                            }))
                          }
                        />
                        <span className="text-sm text-slate-500">%</span>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documentos">
            <Card>
              <CardContent className="space-y-4 p-6">
                {[
                  { label: "Foto", url: photoUrl, setUrl: setPhotoUrl },
                  { label: "Contrato", url: contractUrl, setUrl: setContractUrl },
                  {
                    label: "Seguro de Vida",
                    url: insuranceUrl,
                    setUrl: setInsuranceUrl,
                  },
                  {
                    label: "Certidão Negativa",
                    url: certidaoUrl,
                    setUrl: setCertidaoUrl,
                  },
                ].map((doc) => (
                  <div key={doc.label} className="space-y-2">
                    <Label>{doc.label} (opcional)</Label>
                    <div className="flex items-center gap-3">
                      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-2 text-sm text-slate-600 transition-colors hover:border-blue-400">
                        <Upload className="h-4 w-4" />
                        Enviar arquivo
                        <input
                          type="file"
                          className="hidden"
                          disabled={uploading}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(file, "documents", doc.setUrl);
                          }}
                        />
                      </label>
                      {doc.url && (
                        <span className="text-xs text-emerald-600">
                          Arquivo enviado
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="mt-6 flex gap-3">
          <Button type="submit" disabled={saveMutation.isPending}>
            {saveMutation.isPending
              ? "Salvando..."
              : isEditing
              ? "Atualizar Motorista"
              : "Cadastrar Motorista"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/motoristas")}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}
