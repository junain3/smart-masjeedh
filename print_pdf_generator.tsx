// PRINT-FRIENDLY PDF GENERATOR - No jsPDF Dependency
// Use browser's native print functionality

export const generatePrintablePDF = (
  title: string, 
  headers: string[], 
  data: any[][], 
  filename: string
) => {
  try {
    console.log(`Starting ${filename} print generation...`);
    
    // Check client-side
    if (typeof window === 'undefined') {
      console.error('Print generation not available in server-side rendering');
      return;
    }
    
    // Create printable HTML
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      alert('Please allow popups for this website to print PDF');
      return;
    }
    
    // Generate HTML content
    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            margin: 20px; 
            font-size: 12px;
            line-height: 1.4;
          }
          h1 { 
            text-align: center; 
            margin-bottom: 20px;
            font-size: 18px;
            font-weight: bold;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 20px;
          }
          th, td { 
            border: 1px solid #333; 
            padding: 8px; 
            text-align: left;
            vertical-align: top;
          }
          th { 
            background-color: #f0f0f0; 
            font-weight: bold;
            font-size: 11px;
          }
          td { 
            font-size: 10px;
            word-wrap: break-word;
            max-width: 150px;
          }
          .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 10px;
            color: #666;
          }
          @media print {
            body { margin: 10px; }
            th, td { 
              border: 1px solid #000; 
              padding: 6px;
              font-size: 9px;
            }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <table>
          <thead>
            <tr>
    `;
    
    // Add headers
    headers.forEach(header => {
      htmlContent += `<th>${header}</th>`;
    });
    htmlContent += `
            </tr>
          </thead>
          <tbody>
    `;
    
    // Add data rows
    data.forEach(row => {
      htmlContent += '<tr>';
      row.forEach(cell => {
        const cellValue = String(cell || '');
        const truncatedValue = cellValue.length > 50 ? cellValue.substring(0, 50) + '...' : cellValue;
        htmlContent += `<td>${truncatedValue}</td>`;
      });
      htmlContent += '</tr>';
    });
    
    htmlContent += `
          </tbody>
        </table>
        <div class="footer">
          Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}
        </div>
        <div class="no-print" style="margin-top: 20px; text-align: center;">
          <button onclick="window.print()" style="padding: 10px 20px; font-size: 14px;">
            🖨️ Print / Save as PDF
          </button>
          <br><br>
          <small>Use Ctrl+P or Cmd+P to print, then choose "Save as PDF"</small>
        </div>
      </body>
      </html>
    `;
    
    // Write content to new window
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // Focus and trigger print dialog
    printWindow.focus();
    
    console.log(`${filename} print window opened successfully`);
    
  } catch (error) {
    console.error(`${filename} print generation error:`, error);
    alert(`Print generation failed: ${(error as Error).message}`);
  }
};

// SPECIFIC IMPLEMENTATIONS
export const generateFamiliesPrint = (families: any[]) => {
  const headers = ['Code', 'Head Name', 'Phone', 'Sub Amt', 'Address'];
  const data = families.map(f => [
    f.family_code || '',
    f.head_name || '',
    f.phone || '',
    String(f.subscription_amount || 0),
    f.address || ''
  ]);
  
  generatePrintablePDF('Masjid Families List', headers, data, 'families_list');
};

export const generateTransactionsPrint = (transactions: any[]) => {
  const headers = ['Date', 'Description', 'Category', 'Type', 'Amount'];
  const data = transactions.map(t => [
    t.date || '',
    t.description || '',
    t.category || '',
    t.type || '',
    `Rs. ${t.amount || 0}`
  ]);
  
  generatePrintablePDF('Masjid Transactions Report', headers, data, 'transactions_report');
};

export const generateEventsPrint = (events: any[]) => {
  const headers = ['Date', 'Name', 'ID'];
  const data = events.map(e => [
    e.date || '',
    e.name || '',
    e.id || ''
  ]);
  
  generatePrintablePDF('Events List', headers, data, 'events');
};

export const generateCollectionsPrint = (collections: any[]) => {
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
  
  generatePrintablePDF('Staff Collections Report', headers, data, 'staff_collections');
};

export const generatePendingPrint = (collections: any[]) => {
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
  
  generatePrintablePDF('Pending Collections Report', headers, data, 'pending_collections');
};

export const generateSalaryPrint = (balances: any[]) => {
  const headers = ['Staff Email', 'Total Earned', 'Total Paid', 'Available'];
  const data = balances.map(b => [
    b.staff_email || '',
    String(b.total_commission_earned || 0),
    String(b.total_commission_paid || 0),
    String(b.available_balance || 0)
  ]);
  
  generatePrintablePDF('Staff Commission Balances Report', headers, data, 'staff_commission_balances');
};

export default generatePrintablePDF;
