// Manual PDF Generator - No AutoTable Dependency
// Use this if autoTable continues to fail

import jsPDF from 'jspdf';

export const generateManualPDF = (title: string, headers: string[], data: string[][], filename: string) => {
  try {
    console.log(`Starting manual ${filename} PDF generation...`);
    
    // Check client-side
    if (typeof window === 'undefined') {
      console.error('PDF generation not available in server-side rendering');
      return;
    }
    
    // Create PDF
    const doc = new jsPDF();
    
    // Add title
    doc.text(title, 14, 15);
    
    // Create manual table
    let yPosition = 30;
    
    // Draw headers
    headers.forEach((header, index) => {
      const xPosition = 14 + (index * 40);
      doc.text(header, xPosition, yPosition);
    });
    yPosition += 10;
    
    // Draw data rows
    data.forEach(row => {
      row.forEach((cell, index) => {
        const xPosition = 14 + (index * 40);
        // Truncate long text
        const truncatedText = cell.length > 15 ? cell.substring(0, 15) + '...' : cell;
        doc.text(truncatedText, xPosition, yPosition);
      });
      yPosition += 8;
      
      // Add new page if needed
      if (yPosition > 280) {
        doc.addPage();
        yPosition = 20;
      }
    });
    
    // Save PDF
    doc.save(`${filename}.pdf`);
    console.log(`${filename} PDF download initiated`);
    
  } catch (error) {
    console.error(`${filename} PDF generation error:`, error);
    alert(`PDF generation failed: ${error.message}`);
  }
};

// Example usage for families
export const generateFamiliesPDF = (families: any[], filename: string) => {
  const headers = ['Code', 'Name', 'Phone', 'Amount'];
  const data = families.map(f => [
    f.family_code || '',
    f.head_name || '',
    f.phone || '',
    f.subscription_amount?.toString() || '0'
  ]);
  
  generateManualPDF('Families List', headers, data, filename);
};

// Example usage for transactions
export const generateTransactionsPDF = (transactions: any[], filename: string) => {
  const headers = ['Date', 'Desc', 'Type', 'Amount'];
  const data = transactions.map(t => [
    t.date || '',
    t.description?.substring(0, 15) || '',
    t.type || '',
    t.amount?.toString() || '0'
  ]);
  
  generateManualPDF('Transactions Report', headers, data, filename);
};

export default generateManualPDF;
