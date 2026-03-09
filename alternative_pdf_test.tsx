// Alternative PDF Generation - More Robust Approach
// Use this if current jsPDF approach doesn't work

import { useRef } from 'react';

export const generatePDFAlternative = (data: any[], filename: string) => {
  try {
    console.log('Starting alternative PDF generation...');
    
    // Method 1: Check if jsPDF is available
    if (typeof window !== 'undefined' && (window as any).jspdf) {
      console.log('Using jsPDF method...');
      const { jsPDF } = (window as any).jspdf;
      const doc = new jsPDF();
      
      // Add content
      doc.text("Report", 14, 15);
      
      // Create table data
      const tableData = data.map((item, index) => [
        index + 1,
        item.name || item.head_name || 'N/A',
        item.amount || item.value || 'N/A'
      ]);
      
      // Add table
      doc.autoTable({
        startY: 20,
        head: [['#', 'Name', 'Amount']],
        body: tableData,
      });
      
      // Save
      doc.save(filename);
      console.log('PDF saved using jsPDF method');
      return true;
    }
    
    // Method 2: Use window.print() as fallback
    console.log('Using print method fallback...');
    const printContent = data.map(item => 
      `${item.name || item.head_name}: ${item.amount || item.value}`
    ).join('\n');
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${filename}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              table { border-collapse: collapse; width: 100%; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
            </style>
          </head>
          <body>
            <h1>${filename}</h1>
            <table>
              <tr><th>Name</th><th>Amount</th></tr>
              ${data.map(item => 
                `<tr><td>${item.name || item.head_name || 'N/A'}</td><td>${item.amount || item.value || 'N/A'}</td></tr>`
              ).join('')}
            </table>
            <script>
              window.print();
              window.close();
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
      console.log('Print dialog opened');
      return true;
    }
    
    console.error('No PDF generation method available');
    return false;
  } catch (error) {
    console.error('Alternative PDF generation failed:', error);
    return false;
  }
};
