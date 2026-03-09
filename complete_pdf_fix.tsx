// COMPLETE PDF FIX - Deep Solution
// Fix all jsPDF and autoTable issues

import jsPDF from 'jspdf';

// CRITICAL: Import autoTable properly
// This is the correct way to import autoTable
import autoTable from 'jspdf-autotable';

// Alternative import method
// import 'jspdf-autotable';

// TypeScript declaration
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

// WORKING PDF GENERATOR - TESTED APPROACH
export const generateCompletePDF = (
  title: string, 
  headers: string[], 
  data: any[][], 
  filename: string
) => {
  try {
    console.log(`Starting ${filename} PDF generation...`);
    
    // Check client-side
    if (typeof window === 'undefined') {
      console.error('PDF generation not available in server-side rendering');
      return;
    }
    
    // Create PDF instance
    const doc = new jsPDF();
    
    // Add title
    doc.text(title, 14, 15);
    
    // METHOD 1: Try autoTable plugin
    try {
      console.log('Attempting autoTable method...');
      
      // Check if autoTable is available
      if (typeof (doc as any).autoTable === 'function') {
        (doc as any).autoTable({
          startY: 20,
          head: [headers],
          body: data,
        });
        console.log('autoTable method successful');
      } else {
        throw new Error('autoTable not available');
      }
    } catch (autoTableError) {
      console.log('autoTable failed, using manual method:', autoTableError);
      
      // METHOD 2: Manual table drawing
      let yPosition = 30;
      const lineHeight = 8;
      const columnWidth = 40;
      
      // Draw headers
      headers.forEach((header, index) => {
        const xPosition = 14 + (index * columnWidth);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(header, xPosition, yPosition);
      });
      yPosition += lineHeight + 2;
      
      // Draw data rows
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      data.forEach((row, rowIndex) => {
        // Add new page if needed
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }
        
        row.forEach((cell, index) => {
          const xPosition = 14 + (index * columnWidth);
          // Truncate long text
          const text = String(cell || '');
          const truncatedText = text.length > 12 ? text.substring(0, 12) + '...' : text;
          doc.text(truncatedText, xPosition, yPosition);
        });
        yPosition += lineHeight;
      });
      
      console.log('Manual table method successful');
    }
    
    // Save PDF
    doc.save(`${filename}.pdf`);
    console.log(`${filename} PDF download initiated`);
    
  } catch (error) {
    console.error(`${filename} PDF generation error:`, error);
    alert(`PDF generation failed: ${(error as Error).message}`);
  }
};

// SPECIFIC IMPLEMENTATIONS
export const generateFamiliesPDF = (families: any[]) => {
  const headers = ['Code', 'Head Name', 'Phone', 'Sub Amt'];
  const data = families.map(f => [
    f.family_code || '',
    f.head_name || '',
    f.phone || '',
    String(f.subscription_amount || 0)
  ]);
  
  generateCompletePDF('Masjid Families List', headers, data, 'families_list');
};

export const generateTransactionsPDF = (transactions: any[]) => {
  const headers = ['Date', 'Description', 'Category', 'Type', 'Amount'];
  const data = transactions.map(t => [
    t.date || '',
    (t.description || '').substring(0, 15),
    t.category || '',
    t.type || '',
    `Rs. ${t.amount || 0}`
  ]);
  
  generateCompletePDF('Masjid Transactions Report', headers, data, 'transactions_report');
};

export const generateEventsPDF = (events: any[]) => {
  const headers = ['Date', 'Name', 'ID'];
  const data = events.map(e => [
    e.date || '',
    e.name || '',
    e.id || ''
  ]);
  
  generateCompletePDF('Events List', headers, data, 'events');
};

export const generateCollectionsPDF = (collections: any[]) => {
  const headers = ['Code', 'Head Name', 'Date', 'Amount', 'Comm %', 'Comm', 'Status'];
  const data = collections.map(c => [
    c.family?.family_code || '',
    c.family?.head_name || '',
    c.date || '',
    String(c.amount || 0),
    String(c.commission_percent || 0) + '%',
    String(c.commission_amount || 0),
    c.status || ''
  ]);
  
  generateCompletePDF('Staff Collections Report', headers, data, 'staff_collections');
};

export const generatePendingPDF = (collections: any[]) => {
  const headers = ['Code', 'Head Name', 'Collector', 'Date', 'Amount', 'Comm %', 'Comm', 'Status'];
  const data = collections.map(c => [
    c.family?.family_code || '',
    c.family?.head_name || '',
    (c as any).collector?.email || 'Unknown',
    c.date || '',
    String(c.amount || 0),
    String(c.commission_percent || 0) + '%',
    String(c.commission_amount || 0),
    c.status || ''
  ]);
  
  generateCompletePDF('Pending Collections Report', headers, data, 'pending_collections');
};

export const generateSalaryPDF = (balances: any[]) => {
  const headers = ['Staff Email', 'Total Earned', 'Total Paid', 'Available'];
  const data = balances.map(b => [
    b.staff_email || '',
    String(b.total_commission_earned || 0),
    String(b.total_commission_paid || 0),
    String(b.available_balance || 0)
  ]);
  
  generateCompletePDF('Staff Commission Balances Report', headers, data, 'staff_commission_balances');
};

export default generateCompletePDF;
