"use client";

import { forwardRef } from "react";

type SearchResultsPrintViewProps = {
  title: string;
  results: any[];
  columns: { key: string; label: string }[];
  masjidName?: string;
};

const SearchResultsPrintView = forwardRef<HTMLDivElement, SearchResultsPrintViewProps>(
  ({ title, results, columns, masjidName = "Masjid" }, ref) => {
    return (
      <div 
        ref={ref}
        className="w-full text-black bg-white p-8 font-sans"
      >
        {/* Header Section */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black uppercase text-emerald-800 mb-2">
            {masjidName}
          </h1>
          <h2 className="text-xl font-bold text-emerald-700">
            {title}
          </h2>
          <hr className="border-t-3 border-emerald-600 my-6" />
          <p className="text-sm text-gray-700">
            Generated on {new Date().toLocaleString()}
          </p>
          <p className="text-base text-gray-800 font-bold mt-1">
            Total Results: {results.length}
          </p>
        </div>

        {/* Table Section */}
        <table className="w-full border-collapse border border-emerald-300 text-sm text-black">
          <thead>
            <tr className="bg-gradient-to-r from-emerald-700 to-emerald-600 text-white">
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  className="border border-emerald-500 px-4 py-3 text-left font-bold"
                >
                  {col.label}
                </th>
              ))}
              <th className="border border-emerald-500 px-4 py-3 text-center font-bold min-w-[120px]">
                கையொப்பம்
              </th>
            </tr>
          </thead>
          <tbody>
            {results.map((result, rowIdx) => (
              <tr key={rowIdx} className={`border border-emerald-200 ${rowIdx % 2 === 0 ? "bg-white" : "bg-emerald-50"}`}>
                {columns.map((col, colIdx) => (
                  <td
                    key={colIdx}
                    className="border border-emerald-200 px-4 py-3 text-sm text-gray-800"
                  >
                    {result[col.key] ?? "-"}
                  </td>
                ))}
                <td className="border border-emerald-200 px-4 py-3 text-center min-w-[120px]"></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
);

SearchResultsPrintView.displayName = "SearchResultsPrintView";

export default SearchResultsPrintView;
