"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { EmployeeForm } from "@/components/employee-form";
import { useParams } from "next/navigation";
import type { Employee } from "@/types";

export default function EditFuncionarioPage() {
  const params = useParams();
  const id = params.id as string;

  const { data: employee, isLoading } = useQuery<Employee>({
    queryKey: ["employee", id],
    queryFn: () => api.get(`/api/employees/${id}`),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-blue-600" />
      </div>
    );
  }

  if (!employee) return <p>Funcionário não encontrado.</p>;

  return <EmployeeForm employee={employee} />;
}
