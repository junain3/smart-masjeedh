// Fix PDF Import Issues - Remove CDN Dependencies
// Use only npm packages, no external CDN

// CORRECT WAY - Use npm packages only
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Add proper TypeScript declaration
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

// WORKING PDF FUNCTION TEMPLATE
export const generateWorkingPDF = (data: any[], filename: string) => {
  try {
    console.log(`Starting ${filename} PDF generation...`);
    
    // Check client-side
    if (typeof window === 'undefined') {
      console.error('PDF generation not available in server-side rendering');
      return;
    }
    
    // Create PDF
    const doc = new jsPDF();
    
    // Add title
    doc.text(filename, 14, 15);
    
    // Add table data
    const tableData = data.map((item, index) => [
      index + 1,
      item.name || 'N/A',
      item.value || item.amount || 'N/A'
    ]);
    
    // Add table
    doc.autoTable({
      startY: 20,
      head: [['#', 'Name', 'Amount']],
      body: tableData,
    });
    
    // Save PDF
    doc.save(`${filename}.pdf`);
    console.log(`${filename} PDF download initiated`);
    
  } catch (error) {
    console.error(`${filename} PDF generation error:`, error);
    alert(`PDF generation failed: ${error.message}`);
  }
};

// TEST THIS APPROACH INSTEAD OF CDN
export default generateWorkingPDF;
