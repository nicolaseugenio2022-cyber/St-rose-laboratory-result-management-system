import React from "react";
import { PatientDemographics, PatientSex } from "@/domain/types";
import { formatDateISO } from "@/lib/utils";
import { User, Calendar, MapPin } from "lucide-react";

export interface PatientDemographicsFormProps {
  demographics: PatientDemographics;
  onChange: (updated: PatientDemographics) => void;
}

export function PatientDemographicsForm({
  demographics,
  onChange,
}: PatientDemographicsFormProps) {
  const handleChange = (field: keyof PatientDemographics, value: unknown) => {
    onChange({
      ...demographics,
      [field]: value,
    });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm mb-3">
      <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-slate-100">
        <User className="h-4 w-4 text-brand-primary" />
        <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
          Patient Demographics
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-8 gap-x-3 gap-y-2.5">
        {/* Full Name */}
        <div className="sm:col-span-2">
          <label htmlFor="patient-full-name" className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">
            Patient Full Name <span className="text-rose-500">*</span>
          </label>
          <input
            id="patient-full-name"
            type="text"
            value={demographics.fullName}
            onChange={(e) => handleChange("fullName", e.target.value)}
            placeholder="e.g. Dela Cruz, Juan Santos"
            className="w-full scroll-mt-32 px-2.5 py-1 text-xs rounded-md border border-slate-300 focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary focus:outline-none font-medium"
            required
          />
        </div>

        {/* Simplified Age Field */}
        <div>
          <label htmlFor="patient-age" className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">
            Age <span className="text-rose-500">*</span>
          </label>
          <input
            id="patient-age"
            type="number"
            min="0"
            value={demographics.age || ""}
            onChange={(e) => handleChange("age", parseInt(e.target.value, 10) || 0)}
            className="w-full scroll-mt-32 px-2.5 py-1 text-xs rounded-md border border-slate-300 focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary focus:outline-none font-medium"
            placeholder="e.g. 35"
            required
          />
        </div>

        {/* Sex Field with No Default Selection */}
        <div>
          <label htmlFor="patient-sex" className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">
            Sex <span className="text-rose-500">*</span>
          </label>
          <select
            id="patient-sex"
            value={demographics.sex || ""}
            onChange={(e) => handleChange("sex", e.target.value as PatientSex)}
            className="w-full scroll-mt-32 px-2.5 py-1 text-xs rounded-md border border-slate-300 focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary focus:outline-none bg-white font-medium"
            required
          >
            <option value="" disabled>
              -- Select Sex --
            </option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </div>

        {/* Examination Date */}
        <div className="2xl:col-span-2">
          <label htmlFor="patient-examination-date" className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">
            Examination Date <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              id="patient-examination-date"
              type="date"
              value={demographics.examinationDate || formatDateISO()}
              onChange={(e) => handleChange("examinationDate", e.target.value)}
              className="w-full scroll-mt-32 px-2.5 py-1 text-xs rounded-md border border-slate-300 focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary focus:outline-none font-medium"
              required
            />
            <Calendar className="absolute right-2.5 top-1.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Multiline Editable Address */}
        <div className="sm:col-span-2">
          <label htmlFor="patient-address" className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">
            Address
          </label>
          <div className="relative">
            <textarea
              id="patient-address"
              rows={2}
              value={demographics.address || ""}
              onChange={(e) => handleChange("address", e.target.value)}
              placeholder="Enter complete patient address..."
              className="w-full scroll-mt-32 px-2.5 py-1 text-xs rounded-md border border-slate-300 focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary focus:outline-none resize-none font-medium"
            />
            <MapPin className="absolute right-2.5 top-1.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>
    </div>
  );
}
