"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatBRL, formatWeight } from "@/lib/format";
import { toast } from "sonner";
import type { Driver, CompanyName } from "@/types";

const COMPANIES: CompanyName[] = ["Ascop", "Cooplider", "Alimex"];

interface CargoEntry {
  company: CompanyName;
  enabled: boolean;
  weight_kg: number;
  value_brl: number;
}

export default function NovaViagemPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: drivers = [] } = useQuery<Driver[]>({
    queryKey: ["drivers"],
    queryFn: () => api.get("/api/drivers"),
  });

  const [driverId, setDriverId] = useState("");
  const [tripDate, setTripDate] = useState(new Date().toISOString().slice(0, 10));
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [notes, setNotes] = useState("");
  const [cargo, setCargo] = useState<CargoEntry[]>(
    COMPANIES.map((c) => ({ company: c, enabled: false, weight_kg: 0, value_brl: 0 }))
  );

  const totalWeight = cargo
    .filter((c) => c.enabled)
    .reduce((s, c) => s + c.weight_kg, 0);
  const totalValue = cargo
    .filter((c) => c.enabled)
    .reduce((s, c) => s + c.value_brl, 0);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.post("/api/trips", {
        driver_id: driverId,
        trip_date: tripDate,
        origin: origin || null,
        destination: destination || null,
        notes: notes || null,
        cargo: cargo
          .filter((c) => c.enabled)
          .map((c) => ({
            company: c.company,
            weight_kg: c.weight_kg,
            value_brl: c.value_brl,
          })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      toast.success("Viagem registrada com sucesso.");
      router.push("/viagens");
    },
    onError: () => {
      toast.error("Erro ao registrar viagem.");
    },
  });

  const updateCargo = (idx: number, field: string, value: unknown) => {
    setCargo((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c))
    );
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Nova Viagem</h1>
        <p className="text-sm text-slate-500">Registre uma nova viagem</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!driverId) {
            toast.error("Selecione um motorista.");
            return;
          }
          if (!cargo.some((c) => c.enabled)) {
            toast.error("Adicione pelo menos uma carga.");
            return;
          }
          saveMutation.mutate();
        }}
      >
        <Card className="mb-6">
          <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Motorista *</Label>
              <Select value={driverId} onValueChange={(v) => setDriverId(v ?? "")}>
                <SelectTrigger>
                  <SelectValue>
                    {(v: string | null) =>
                      drivers.find((d) => d.id === v)?.name || "Selecione o motorista"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {drivers.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data da Viagem *</Label>
              <Input
                type="date"
                value={tripDate}
                onChange={(e) => setTripDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Origem</Label>
              <Input
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Destino</Label>
              <Input
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Carga por Empresa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {cargo.map((entry, idx) => (
              <div
                key={entry.company}
                className="rounded-lg border p-4"
              >
                <label className="mb-3 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={entry.enabled}
                    onChange={(e) =>
                      updateCargo(idx, "enabled", e.target.checked)
                    }
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span className="font-medium">{entry.company}</span>
                </label>
                {entry.enabled && (
                  <div className="grid grid-cols-2 gap-3 pl-6">
                    <div className="space-y-1">
                      <Label className="text-xs">Peso (kg)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={entry.weight_kg || ""}
                        placeholder="0,00"
                        onChange={(e) =>
                          updateCargo(idx, "weight_kg", Number(e.target.value))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Valor (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={entry.value_brl || ""}
                        placeholder="0,00"
                        onChange={(e) =>
                          updateCargo(idx, "value_brl", Number(e.target.value))
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div className="flex justify-between rounded-lg bg-slate-50 p-4 text-sm">
              <span className="text-slate-500">
                Peso Total: <strong>{formatWeight(totalWeight)}</strong>
              </span>
              <span className="text-slate-500">
                Valor Total: <strong>{formatBRL(totalValue)}</strong>
              </span>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Salvando..." : "Registrar Viagem"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/viagens")}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}
