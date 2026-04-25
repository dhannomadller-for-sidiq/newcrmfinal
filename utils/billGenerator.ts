import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { supabase } from '@/utils/supabase';

export async function generatePaymentBill(leadId: string) {
  try {
    // 1. Fetch Lead Data with Itinerary Title
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*, profiles!assigned_to(name), itineraries(title)')
      .eq('id', leadId)
      .single();

    if (leadError) throw leadError;

    // 2. Fetch Booking Data
    const { data: bookingData, error: bookingError } = await supabase
      .from('confirmed_bookings')
      .select('*')
      .eq('lead_id', leadId)
      .maybeSingle();

    if (bookingError) throw bookingError;
    
    // Provide fallback if booking data doesn't exist yet
    const booking = bookingData || {
      advance_paid: 0,
      total_amount: 0,
      guest_list: lead.name,
      region: 'Unknown',
      guest_pax: '2',
    };

    // 3. Fetch Payments (We only need them if we want to list them, but for total summary we use booking dues)
    const totalUSD = booking.total_amount_usd || (booking.total_amount ? booking.total_amount / 95 : 0);
    const dueUSD = booking.due_amount_usd ?? (booking.due_amount ? booking.due_amount / 95 : totalUSD);
    const paidUSD = totalUSD - dueUSD;
    
    const dateStr = new Date().toLocaleDateString('en-GB');

    // Get primary guest name (first one)
    const primaryGuest = (booking.guest_list || lead.name || 'Guest')
      .split('\n')[0]?.trim();
    
    // Itinerary Display Name
    const itinTitle = lead.itineraries?.title || 'Tour Package';
    const itinOption = lead.itinerary_option ? ` (${lead.itinerary_option.toUpperCase()})` : '';
    const productName = `${itinTitle}${itinOption}`;

    const productRow = `
      <tr>
        <td class="product-name">${productName}</td>
        <td class="text-center">${booking.guest_pax || '2'}</td>
        <td class="text-right">$ ${totalUSD.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
      </tr>
    `;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&display=swap');
          
          body {
            font-family: 'Montserrat', sans-serif;
            padding: 40px;
            color: #000;
            background: #fff;
          }

          .header-bar {
            background-color: #1e1e1e;
            color: #fff;
            padding: 15px 25px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
          }

          .brand-name {
            font-size: 28px;
            font-weight: 800;
            letter-spacing: 1px;
            font-style: italic;
          }

          .date-text {
            font-size: 14px;
            font-weight: 600;
          }

          .title-section {
            margin-bottom: 40px;
          }

          .title-text {
            font-size: 18px;
            font-weight: 700;
            color: #000;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }

          .table-header {
            background-color: #2d2d2d;
            color: #fff;
          }

          th {
            text-align: left;
            padding: 12px 15px;
            font-size: 12px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 1px;
          }

          td {
            padding: 12px 15px;
            font-size: 14px;
            color: #000;
            border-bottom: 1px solid #eee;
          }

          .product-name {
            font-weight: 700;
          }

          .text-center { text-align: center; }
          .text-right { text-align: right; font-weight: 700; }

          .spacer {
            height: 100px;
          }

          .summary-container {
            border-top: 1px solid #ccc;
            padding-top: 30px;
            display: flex;
            justify-content: space-between;
          }

          .payment-status {
            flex: 1;
          }

          .status-label {
            font-size: 14px;
            font-weight: 800;
            color: #000;
            text-transform: uppercase;
          }

          .status-value {
            font-size: 13px;
            color: #333;
            margin-top: 5px;
            font-weight: 600;
          }

          .finance-summary {
            width: 320px;
          }

          .fin-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            align-items: center;
          }

          .fin-label {
            font-size: 14px;
            font-weight: 800;
            color: #000;
            text-transform: uppercase;
          }

          .fin-val {
            font-size: 14px;
            font-weight: 700;
            color: #000;
          }

          .total-bar {
            background-color: #262626;
            color: #fff;
            padding: 12px 15px;
            margin-top: 10px;
          }

          .total-bar .fin-label, .total-bar .fin-val {
            color: #fff;
          }

          .footer {
            margin-top: 60px;
            border-top: 1px solid #eee;
            padding-top: 20px;
            display: flex;
            justify-content: space-between;
          }

          .company-card {
            font-size: 11px;
            line-height: 1.6;
            color: #666;
            font-weight: 600;
          }

          .thank-you {
            font-size: 24px;
            font-style: italic;
            font-weight: 700;
            color: #333;
            align-self: flex-end;
          }
        </style>
      </head>
      <body>
        <div class="header-bar">
          <div class="brand-name">NOMADLLER PVT LTD</div>
          <div class="date-text">${dateStr}</div>
        </div>

        <div class="title-section">
          <div class="title-text">Booking Confirmation Nomadller Pvt Ltd</div>
          <div style="margin-top: 15px; font-size: 14px; border-bottom: 2px solid #000; padding-bottom: 5px; width: fit-content;">
            <span style="font-weight: 800; text-transform: uppercase;">Guest Name:</span> 
            <span style="font-weight: 400; margin-left: 10px;">${primaryGuest}</span>
          </div>
        </div>

        <table>
          <tr class="table-header">
            <th style="width: 50%;">PRODUCT</th>
            <th class="text-center">NO OF PAX</th>
            <th class="text-right">TOTAL</th>
          </tr>
          ${productRow}
        </table>

        <div class="spacer"></div>

        <div class="summary-container">
          <div class="payment-status">
            <div class="status-label">PAYMENT STATUS</div>
            <div class="status-value">${dueUSD <= 0 ? 'FULLY PAID' : 'PENDING'}</div>
          </div>
          
          <div class="finance-summary">
            <div class="fin-row">
              <span class="fin-label">REMITTED ($)</span>
              <span class="fin-val">$ ${paidUSD.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
            </div>
            <div class="fin-row">
              <span class="fin-label">BALANCE ($)</span>
              <span class="fin-val">$ ${dueUSD.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
            </div>
            <div class="fin-row total-bar">
              <span class="fin-label">TOTAL ($)</span>
              <span class="fin-val">$ ${totalUSD.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
            </div>
          </div>
        </div>

        <div class="footer">
          <div class="company-card">
            <div style="font-weight: 800; color: #000; font-size: 12px; margin-bottom: 5px;">Nomadller pvt ltd</div>
            1st Floor, Shabana Building, <br/>
            Puzhakkarapadam Junction, Vennala High <br/>
            School Rd, Vennala, Kochi, Kerala 682028 <br/>
            <strong>nomadllercommunity@gmail.com</strong>
          </div>
          <div class="thank-you">Thank You !!</div>
        </div>
      </body>
      </html>
    `;

    if (Platform.OS === 'web') {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
      iframe.contentDocument?.open();
      iframe.contentDocument?.write(html);
      iframe.contentDocument?.close();
      
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    } else {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    }
    
  } catch (error: any) {
    console.error('Generating Bill Error:', error);
    throw error;
  }
}
