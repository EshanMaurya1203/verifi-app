"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AdminPage() {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data } = await supabase
      .from("startup_submissions")
      .select("*")
      .eq("verification_status", "pending");

    setData(data || []);
  };

  const updateStatus = async (id: number, status: string) => {
    await supabase
      .from("startup_submissions")
      .update({ verification_status: status })
      .eq("id", id);

    fetchData();
  };

  return (
    <div className="p-10 text-white">
      <h1 className="text-2xl mb-6">Admin Moderation</h1>

      {data.map((item) => (
        <div key={item.id} className="mb-4 border p-4 rounded">
          <p>{item.startup_name}</p>
          <p>MRR: ₹{item.mrr}</p>

          <div className="flex gap-2 mt-2">
            <button onClick={() => updateStatus(item.id, "verified")}>
              Approve
            </button>
            <button onClick={() => updateStatus(item.id, "rejected")}>
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
