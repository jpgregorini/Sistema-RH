"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DriverForm } from "@/components/driver-form";
import { useParams } from "next/navigation";
import type { Driver } from "@/types";

export default function EditMotoristaPage() {
  const params = useParams();
  const id = params.id as string;

  const { data: driver, isLoading } = useQuery<Driver>({
    queryKey: ["driver", id],
    queryFn: () => api.get(`/api/drivers/${id}`),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-blue-600" />
      </div>
    );
  }

  if (!driver) return <p>Motorista não encontrado.</p>;

  return <DriverForm driver={driver} />;
}
