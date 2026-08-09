"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientDemographicsBlock = PatientDemographicsBlock;
const jsx_runtime_1 = require("react/jsx-runtime");
function PatientDemographicsBlock({ demographics, patientStatusOutputMode = "label-and-value", ageOutputMode = "number-with-unit", }) {
    const ageDisplay = demographics.age
        ? ageOutputMode === "number-only"
            ? String(demographics.age)
            : `${demographics.age} ${demographics.ageUnit || ""}`.trim()
        : "";
    let statusDisplay = "";
    if (demographics.patientStatus === "InPatient") {
        statusDisplay = "In-Patient";
    }
    else if (demographics.patientStatus === "OutPatient") {
        statusDisplay = "Out-Patient";
    }
    else if (demographics.patientStatus) {
        statusDisplay = demographics.patientStatus;
    }
    return ((0, jsx_runtime_1.jsx)("div", { className: "w-full mb-1 text-[11px] leading-tight font-sans text-black", children: (0, jsx_runtime_1.jsx)("table", { className: "w-full border-collapse border border-[#7E749C]", children: (0, jsx_runtime_1.jsxs)("tbody", { children: [(0, jsx_runtime_1.jsxs)("tr", { className: "border-b border-[#7E749C]", children: [(0, jsx_runtime_1.jsxs)("td", { className: "w-[46%] py-0.75 px-2 align-top font-bold", children: [(0, jsx_runtime_1.jsx)("span", { className: "font-bold", children: "Name: " }), (0, jsx_runtime_1.jsx)("span", { className: "font-bold uppercase", children: demographics.fullName || "" })] }), (0, jsx_runtime_1.jsxs)("td", { className: "w-[18%] py-0.75 px-2 align-top font-bold border-l border-[#7E749C]", children: [(0, jsx_runtime_1.jsx)("span", { className: "font-bold", children: "Age: " }), (0, jsx_runtime_1.jsx)("span", { className: "font-bold", children: ageDisplay })] }), (0, jsx_runtime_1.jsxs)("td", { className: "w-[36%] py-0.75 px-2 align-top font-bold border-l border-[#7E749C]", children: [(0, jsx_runtime_1.jsx)("span", { className: "font-bold", children: "Date: " }), (0, jsx_runtime_1.jsx)("span", { className: "font-bold uppercase", children: demographics.examinationDate || "" })] })] }), (0, jsx_runtime_1.jsxs)("tr", { className: "border-b border-[#7E749C]", children: [(0, jsx_runtime_1.jsxs)("td", { className: "py-0.75 px-2 align-top font-bold", colSpan: 2, children: [(0, jsx_runtime_1.jsx)("span", { className: "font-bold", children: "Address: " }), (0, jsx_runtime_1.jsx)("span", { className: "font-bold uppercase", children: demographics.address || "" })] }), (0, jsx_runtime_1.jsxs)("td", { className: "py-0.75 px-2 align-top font-bold bg-[#EAE6F3] border-l border-[#7E749C]", children: [(0, jsx_runtime_1.jsx)("span", { className: "font-bold", children: "Sex: " }), (0, jsx_runtime_1.jsx)("span", { className: "font-bold uppercase", children: demographics.sex || "" })] })] }), (0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsxs)("td", { className: "py-0.75 px-2 align-top font-bold", colSpan: 2, children: [(0, jsx_runtime_1.jsx)("span", { className: "font-bold", children: "Requested by: " }), (0, jsx_runtime_1.jsx)("span", { className: "font-bold", children: demographics.requestingPhysician || "" })] }), (0, jsx_runtime_1.jsxs)("td", { className: "py-0.75 px-2 align-top font-bold bg-[#EAE6F3] border-l border-[#7E749C]", children: [(0, jsx_runtime_1.jsx)("span", { className: "font-bold", children: patientStatusOutputMode === "static-label-only" ? "Status" : "Status: " }), patientStatusOutputMode === "label-and-value" && ((0, jsx_runtime_1.jsx)("span", { className: "font-bold", children: statusDisplay }))] })] })] }) }) }));
}
