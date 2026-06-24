"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { formatBRL, formatDate } from "@/lib/format";
import { toast } from "sonner";
import type {
  Product,
  ProductDeduction,
  Driver,
  Employee,
  PersonType,
} from "@/types";

export default function ProdutosPage() {
  const queryClient = useQueryClient();

  // --- Catalog state ---
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");

  // --- Withdrawal state ---
  const currentMonth = new Date().toISOString().slice(0, 7);
  const today = new Date().toISOString().slice(0, 10);
  const [month, setMonth] = useState(currentMonth);
  const [personType, setPersonType] = useState<PersonType>("driver");
  const [personId, setPersonId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [deductionDate, setDeductionDate] = useState(today);
  const [payrollMonth, setPayrollMonth] = useState(currentMonth);
  const [withdrawNotes, setWithdrawNotes] = useState("");

  // --- Queries ---
  const { data: products = [], isLoading: loadingProducts } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: () => api.get("/api/products"),
  });

  const { data: drivers = [] } = useQuery<Driver[]>({
    queryKey: ["drivers"],
    queryFn: () => api.get("/api/drivers"),
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["employees"],
    queryFn: () => api.get("/api/employees"),
  });

  const { data: deductions = [], isLoading: loadingDeductions } = useQuery<
    ProductDeduction[]
  >({
    queryKey: ["product-deductions", month],
    queryFn: () => api.get(`/api/product-deductions?month=${month}`),
  });

  const people = personType === "driver" ? drivers : employees;
  const selectedProduct = products.find((p) => p.id === productId);

  // --- Mutations ---
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingProduct) {
        return api.put(`/api/products/${editingProduct.id}`, {
          name,
          price: Number(price),
        });
      }
      return api.post("/api/products", { name, price: Number(price) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(editingProduct ? "Produto atualizado." : "Produto criado.");
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produto removido.");
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: () =>
      api.post("/api/product-deductions", {
        person_type: personType,
        person_id: personId,
        product_id: productId,
        quantity: Number(quantity) || 1,
        deduction_date: deductionDate,
        payroll_month: payrollMonth,
        notes: withdrawNotes || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-deductions"] });
      toast.success("Saída registrada.");
      setPersonId("");
      setProductId("");
      setQuantity("1");
      setWithdrawNotes("");
    },
    onError: (err: Error) => {
      try {
        const parsed = JSON.parse(err.message);
        toast.error(parsed.detail || "Erro ao registrar saída.");
      } catch {
        toast.error("Erro ao registrar saída.");
      }
    },
  });

  const deleteWithdrawal = useMutation({
    mutationFn: (id: string) => api.delete(`/api/product-deductions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-deductions"] });
      toast.success("Saída removida.");
    },
  });

  const resetForm = () => {
    setName("");
    setPrice("");
    setEditingProduct(null);
    setDialogOpen(false);
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    setName(product.name);
    setPrice(String(product.price));
    setDialogOpen(true);
  };

  const getPersonName = (d: ProductDeduction) => {
    if (d.person_type === "driver") {
      const found = drivers.find((x) => x.id === d.person_id);
      if (found) return found.name;
    } else {
      const found = employees.find((x) => x.id === d.person_id);
      if (found) return found.name;
    }
    return d.person_name_snapshot || "—";
  };

  const lineTotal = selectedProduct
    ? Number(selectedProduct.price) * (Number(quantity) || 1)
    : 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Produtos</h1>
        <p className="text-sm text-slate-500">
          Gerencie o catálogo e registre saídas para descontar do salário
        </p>
      </div>

      <Tabs defaultValue="saidas">
        <TabsList className="mb-4">
          <TabsTrigger value="saidas">Saídas</TabsTrigger>
          <TabsTrigger value="catalogo">Catálogo</TabsTrigger>
        </TabsList>

        <TabsContent value="saidas">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">Nova Saída de Produto</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!personId || !productId) {
                    toast.error("Selecione pessoa e produto.");
                    return;
                  }
                  if (!quantity || Number(quantity) <= 0) {
                    toast.error("Quantidade inválida.");
                    return;
                  }
                  withdrawMutation.mutate();
                }}
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              >
                <div className="space-y-2">
                  <Label>Tipo de Pessoa</Label>
                  <Select
                    value={personType}
                    onValueChange={(v) => {
                      if (v) setPersonType(v as PersonType);
                      setPersonId("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {(v: string | null) =>
                          v === "driver"
                            ? "Motorista"
                            : v === "employee"
                            ? "Funcionário"
                            : "Selecione"
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="driver">Motorista</SelectItem>
                      <SelectItem value="employee">Funcionário</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Pessoa</Label>
                  <Select
                    value={personId}
                    onValueChange={(v) => setPersonId(v ?? "")}
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {(v: string | null) =>
                          people.find((p) => p.id === v)?.name || "Selecione"
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {people.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Produto</Label>
                  <Select
                    value={productId}
                    onValueChange={(v) => setProductId(v ?? "")}
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {(v: string | null) => {
                          const p = products.find((x) => x.id === v);
                          return p
                            ? `${p.name} (${formatBRL(p.price)})`
                            : "Selecione";
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} — {formatBRL(p.price)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Quantidade</Label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                  {selectedProduct && (
                    <p className="text-xs text-slate-500">
                      Total: {formatBRL(lineTotal)}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Data da Saída</Label>
                  <Input
                    type="date"
                    value={deductionDate}
                    onChange={(e) => setDeductionDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mês de Desconto</Label>
                  <Input
                    type="month"
                    value={payrollMonth}
                    onChange={(e) => setPayrollMonth(e.target.value)}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2 lg:col-span-3">
                  <Label>Observações</Label>
                  <Textarea
                    value={withdrawNotes}
                    onChange={(e) => setWithdrawNotes(e.target.value)}
                    rows={2}
                  />
                </div>
                <div className="flex items-end">
                  <Button type="submit" disabled={withdrawMutation.isPending}>
                    {withdrawMutation.isPending
                      ? "Registrando..."
                      : "Registrar Saída"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="mb-4 flex items-center gap-3">
            <Label>Mês:</Label>
            <Input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-44"
            />
          </div>

          <div className="rounded-lg border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pessoa</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Preço Unit.</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingDeductions ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-slate-400"
                    >
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : deductions.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-slate-400"
                    >
                      Nenhuma saída neste mês.
                    </TableCell>
                  </TableRow>
                ) : (
                  deductions.map((d) => {
                    const prodName =
                      d.product_name_snapshot ||
                      d.products?.name ||
                      "—";
                    const total = Number(d.unit_price) * Number(d.quantity);
                    return (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">
                          {getPersonName(d)}
                          <div className="text-xs text-slate-400 font-normal">
                            {d.person_type === "driver"
                              ? "Motorista"
                              : "Funcionário"}
                          </div>
                        </TableCell>
                        <TableCell>{prodName}</TableCell>
                        <TableCell className="text-right">
                          {d.quantity}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatBRL(d.unit_price)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatBRL(total)}
                        </TableCell>
                        <TableCell>{formatDate(d.deduction_date)}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => {
                              if (confirm("Remover esta saída?"))
                                deleteWithdrawal.mutate(d.id);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="catalogo">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Cadastre produtos disponíveis para saída
            </p>
            <Dialog
              open={dialogOpen}
              onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) resetForm();
              }}
            >
              <DialogTrigger>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Adicionar Produto
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingProduct ? "Editar Produto" : "Novo Produto"}
                  </DialogTitle>
                </DialogHeader>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveMutation.mutate();
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="prod-name">Nome do Produto</Label>
                    <Input
                      id="prod-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prod-price">Preço (R$)</Label>
                    <Input
                      id="prod-price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="0,00"
                      required
                    />
                  </div>
                  <div className="flex gap-3">
                    <Button type="submit" disabled={saveMutation.isPending}>
                      {saveMutation.isPending ? "Salvando..." : "Salvar"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={resetForm}
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="rounded-lg border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingProducts ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center py-8 text-slate-400"
                    >
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : products.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center py-8 text-slate-400"
                    >
                      Nenhum produto cadastrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">
                        {product.name}
                      </TableCell>
                      <TableCell>{formatBRL(product.price)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(product)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-700"
                            onClick={() => {
                              if (confirm("Remover este produto?")) {
                                deleteMutation.mutate(product.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
