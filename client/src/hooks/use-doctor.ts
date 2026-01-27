import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";

interface Doctor {
  id: number;
  userId: string;
  specialty: string;
  bio: string | null;
  licenseNumber: string;
  consultationFee: number;
  availability: Record<string, { start: string; end: string }[]> | null;
  userName: string | null;
  userImage: string | null;
}

async function fetchDoctorProfile(): Promise<Doctor | null> {
  const response = await fetch("/api/doctors/me", {
    credentials: "include",
  });

  if (response.status === 403 || response.status === 401) {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  return response.json();
}

export type UserRole = "patient" | "doctor";

const ROLE_STORAGE_KEY = "user-role-preference";

export function useDoctor() {
  const { data: doctorProfile, isLoading } = useQuery<Doctor | null>({
    queryKey: ["/api/doctors/me"],
    queryFn: fetchDoctorProfile,
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const isDoctor = !!doctorProfile;

  const [currentRole, setCurrentRole] = useState<UserRole>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(ROLE_STORAGE_KEY);
      if (stored === "doctor" || stored === "patient") {
        return stored;
      }
    }
    return "patient";
  });

  // Update role when doctor status is loaded
  useEffect(() => {
    if (!isLoading) {
      // If user is not a doctor but has doctor role selected, switch to patient
      if (!isDoctor && currentRole === "doctor") {
        setCurrentRole("patient");
        localStorage.setItem(ROLE_STORAGE_KEY, "patient");
      }
    }
  }, [isDoctor, isLoading, currentRole]);

  const switchRole = (role: UserRole) => {
    if (role === "doctor" && !isDoctor) {
      return; // Can't switch to doctor if not a doctor
    }
    setCurrentRole(role);
    localStorage.setItem(ROLE_STORAGE_KEY, role);
  };

  return {
    doctorProfile,
    isDoctor,
    isLoading,
    currentRole,
    switchRole,
  };
}
