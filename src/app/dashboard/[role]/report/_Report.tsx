"use client";

import { Stations } from "@/app/lib/data";
import { EditedRecord, Record } from "@/app/lib/definitions";
import { filterRecordsByTimeRange, G, mergeRecordsWithEdits } from "@/app/lib/utils";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import React, { useEffect, useMemo, useState } from "react";


export default function ReportPage({ fetchedRecords, editedRecords }: { fetchedRecords: Record[], editedRecords: EditedRecord[]; }) {

  const records = useMemo(
    () => mergeRecordsWithEdits(fetchedRecords ?? [], editedRecords ?? []),
    [fetchedRecords, editedRecords]
  );

  const [analysisType, setAnalysisType] = useState<G>({
    startDate: new Date(),
    endDate: null

  });
  const [recordType, setRecordType] = useState<string>("invoice");
  const [rankBy, setRankBy] = useState<string>("service");
  const [sortOrder, setSortOrder] = useState<string>("totalValue");

  const [useRecords, setUseRecords] = useState<Record[]>([]);
  const [recordsOfType, setRecordsOfType] = useState<Record[]>([]);
  const [station, setStation] = useState<string>('Overall');
  const [localRecords, setLocalRecords] = useState<Record[]>([]);
  const getCurrentDate = (): string => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
    const day = String(date.getDate()).padStart(2, "0");
  
    return `${year}-${month}-${day}`;
  };
  const [startDate, setStartDate] = useState<string  >(getCurrentDate());
  const [endDate, setEndDate] = useState<string >("");


  useEffect(()=>{
    if(startDate!=="" && startDate < endDate  ){
      //alert("working")
      setAnalysisType({
        startDate:new Date(startDate),endDate: new Date(endDate)
      })
      
    }else if (startDate === endDate) {
      // If startDate equals endDate, set endDate to the next day
      const newEndDate = new Date(startDate);
      newEndDate.setDate(newEndDate.getDate() + 1); // Add one day to endDate
  
      setAnalysisType({
        startDate: new Date(startDate),
        endDate: newEndDate,
      });
    }
    else{
      setAnalysisType({
        startDate:new Date(startDate),endDate:null
      })
    }
  },[startDate,endDate])

  useEffect(() => {
    if (station === 'Overall') {
      setLocalRecords(records);
    } else {
     const filteredLocalRecords = records?.filter(record => record.userStation === station);
     setLocalRecords(filteredLocalRecords)
    }
    
  }, [station, records])
  

  type GroupedRecords = {
    [key: string]: {
      shift: string;
      count: number;
      counter: string;
      totalValue: number;
    };
  };

  // Update `recordsOfType` whenever `recordType` or `records` changes
  useEffect(() => {
    const filtered = localRecords?.filter(
      (record) => record.recordType === recordType
    );
    setRecordsOfType(filtered);
  }, [recordType, localRecords]);

  // Update `useRecords` whenever `analysisType` or `recordsOfType` changes
  useEffect(() => {
    const filtered = filterRecordsByTimeRange(recordsOfType, analysisType);
    setUseRecords(filtered);
  }, [analysisType, recordsOfType]);

  const groupedRecords = useMemo(() => {
    return useRecords?.reduce((acc: GroupedRecords, record) => {
      const key = rankBy === "service" ? `${record.service}-${record.shift}-${record.counter}` : `${record.userName}-${record.shift}-${record.counter}`;
  
      if (!acc[key]) {
        acc[key] = { count: 0, totalValue: 0, shift: record.shift, counter: record.counter };
      }
      acc[key].count += 1;
      acc[key].counter;
      acc[key].totalValue += record.value;
      return acc;
    }, {} as GroupedRecords);
  }, [useRecords, rankBy]);
   console.log(groupedRecords)
  const sortedGroupedRecords = useMemo(() => {
    if (!groupedRecords) return;
  
    const sorted = Object.entries(groupedRecords).sort((a, b) => {
      if (sortOrder === "totalValue") return b[1].totalValue - a[1].totalValue;
      return b[1].count - a[1].count;
    });
  
    // Map sorted records to include shift in output
    return sorted.map(([key, data]) => {
      const [name, shift] = key.split("-");
      return {
        name,
        shift,
        count: data.count,
        counter: data.counter,
        totalValue: data.totalValue,
      };
    });
  }, [groupedRecords, sortOrder]);
  
  // Calculate overall totals
  const overallTotals = useMemo(() => {
    if (!groupedRecords) return;
  
    return Object.values(groupedRecords).reduce(
      (totals, group) => {
        totals.totalServed += group.count;
        totals.totalValue += group.totalValue;
        return totals;
      },
      { totalServed: 0, totalValue: 0 }
    );
  }, [groupedRecords]);
  

  const generatePDF = () => {
    const doc = new jsPDF();
    let yPos = 20; // Start position for text
  
    // Get the current date
    const currentDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    
    // Title of the report
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(`Service Report Summary - ${station}`, 20, yPos);
    yPos += 10;
  
    // Add date below the title
    doc.setFontSize(12);
    doc.setFont("helvetica", "italic");
    doc.text(`Date: ${currentDate}`, 20, yPos);
    yPos += 15;
  
    // Function to generate table for a given shift
    
    const addShiftTable = (shiftLabel:string, shift:string) => {
      doc.text(`${shiftLabel} Summary`, 20, yPos);
      yPos += 10;
  
      const shiftRecords = sortedGroupedRecords?.filter(record => record.shift === shift) || [];
      if (shiftRecords.length === 0) {
        doc.text("No records found", 20, yPos);
        yPos += 10;
        return;
      }
  
      doc.autoTable({
        startY: yPos,
        head: [["No.", rankBy === "service" ? "Service Category" : "Biller", "Number Served", "Total Value"]],
        body: shiftRecords.map((record, index) => [
          index + 1,
          record.name,
          record.count,
          `${record.totalValue.toLocaleString("en-US")}/=`,
        ]),
        headStyles: {
          fillColor: [46, 125, 50], // Green header
          textColor: [255, 255, 255], // White text
          fontSize: 12,
          fontStyle: "bold",
        },
        bodyStyles: {
          fontSize: 12,
          textColor: [0, 0, 0], // Black text for rows
        },
        margin: { left: 20, right: 20 },
        theme: "grid",
      });
  
      yPos = doc.autoTable.previous.finalY + 15; // Update Y position after table
    };
  
    // Add tables for each shift first
    addShiftTable("Shift 1", "shift 1");
    addShiftTable("Shift 2", "shift 2");
  
    // Summary Section
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Overall Totals", 20, yPos);
    yPos += 10;
  
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Total Customers: ${overallTotals?.totalServed ?? 0}`, 20, yPos);
    yPos += 10;
  
    const totalLabel = recordType === "invoice" ? "Total Invoices" : "Total Receipts";
    doc.text(`${totalLabel}: ${overallTotals?.totalServed ?? 0}`, 20, yPos);
    yPos += 10;
  
    doc.text(`Total Value: ${overallTotals?.totalValue.toLocaleString("en-US")}/=`, 20, yPos);
    yPos += 20;
  
   


    // Footer
    
    doc.setFont("helvetica", "bold");
    doc.setFillColor(0, 128, 0); // Light blue color (RGB)
    doc.rect(0, 275, 300, 20 ,'F'); // Draw a filled rectangle as background for the footer
    doc.setFontSize(20);
    doc.setTextColor("white")
    doc.text(" Let's make Nairobi work ", 80, 285);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(15);
    doc.text("© 2025 All rights reserved.", 90, 290);
      // === Thinner Yellow Section, slightly below the green rectangle ===
    doc.setFillColor(255, 255, 0); // Set color to yellow (RGB)
    doc.rect(0, 295, 300, 10, 'F'); // Thinner yellow-filled rectangle (y=310 and height=10)
    
  
    // Format date for filename (YYYY-MM-DD)
    const formattedDate = new Date().toISOString().split("T")[0];
  
    // Save the PDF with the date in the filename
    doc.save(`service_report_${station}_${formattedDate}.pdf`);
};


  
  
 

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-center mb-6 text-gray-800">
        Service Report Summary
      </h1>
     
      {/* Overall totals */}
      <div className="bg-gradient-to-r from-green-800 to-yellow-600 text-white p-6 rounded-lg shadow-md mb-8">
  
       <select
  id="station"
  value={station}
  onChange={(e) => setStation(e.target.value)}
  className="text-2xl font-semibold text-center bg-transparent border border-none"
>
  <option value="Overall" className="bg-gray-100 text-gray-700 hover:bg-gray-200">Overall total</option>
  {Stations.map((station, index) => (
    <option key={index} value={station.name} className="bg-gray-100 text-gray-700 hover:bg-gray-200">
      {`${station.name} total` }
    </option>
  ))}
</select>

    
        

        
        <div className="flex justify-between">
          <div className="flex items-center justify-items-end text-sm font-semibold uppercase">
            <label htmlFor="analysisType" className="flex-1 mr-2">
              Record Type:
            </label>
            <select
              id="recordType"
              value={recordType}
              onChange={(e) => setRecordType(e.target.value)}
              className="flex-1 border px-2 py-1 rounded text-gray-700"
            >
              <option value="receipt">Receipt</option>
              <option value="invoice">Invoice</option>
            </select>
          </div>
          <div className="flex flex-col items-center justify-items-end text-sm font-semibold uppercase">
            <label htmlFor="analysisType" className="flex-1 mr-2">
              filter period:
            </label>
            {/*<DateInfo/>*/}
            <fieldset className="flex  border bg-gray-50 shadow-sm p-2 text-black rounded-md max-md:w-full">
              {/* <legend>Date</legend> */}
             
              <input
                type="date"
                value={startDate || ""}
                onChange={(e) => setStartDate(e.target.value)}
                className="border px-1 m-1 text-gray-500 rounded bg-gray-100"
              />
              <label className="max-lg:text-sm text-gray-700 mt-2">To</label>
              <input
                type="date"
                value={endDate || ""}
                onChange={(e) => setEndDate(e.target.value)}
                className="border px-1 m-1 text-gray-500 rounded bg-gray-100"
              />
            </fieldset>
            {/*
            <select
              id="analysisType"
              value={analysisType}
              onChange={(e) => setAnalysisType(e.target.value)}
              className="flex-1 border px-2 py-1 rounded text-gray-700"
            >
              <option value="year">This year</option>
              <option value="month">This month</option>
              <option value="week">This week</option>
              <option value="day">Today</option>
            </select>
            */}
          </div>
          
        </div>

        <div className="flex justify-between mt-4 max-w-screen-md mx-auto bg-green-700 border p-2 rounded-lg">
          <div className="flex flex-col flex-1 items-center">
            <p className="text-lg">Total Customers:</p>
            <p className="text-3xl font-extrabold">
              {overallTotals?.totalServed ?? 0}
            </p>
          </div>
          <div className="flex flex-col flex-1 items-center">
            {recordType === "invoice" ? (
              <p className="text-lg">Total Invoices:</p>
            ) : (
              <p className="text-lg">Total Receipt:</p>
            )}

            <p className="text-3xl font-extrabold">
              {overallTotals?.totalServed ?? 0}
            </p>
          </div>
          <div className="flex flex-col flex-1 items-center">
            <p className="text-lg">Total Value:</p>
            <p className="text-3xl font-extrabold">
              {overallTotals?.totalValue.toLocaleString("en-US") ?? 0}/=
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <div className="flex items-center justify-items-end text-sm font-semibold uppercase">
          <label htmlFor="analysisType" className="flex-1 mr-2">
            Ranked by:
          </label>
          <select
            id="rankBy"
            value={rankBy}
            onChange={(e) => setRankBy(e.target.value)}
            className="flex-1 border px-2 py-1 rounded text-gray-700"
          >
            <option value="service">Service</option>
            <option value="biller">Biller</option>
            <option value="biller-ranked">Biller ranked</option>
          </select>
        </div>

        <div className="flex items-center justify-items-end text-sm font-semibold uppercase">
          <label htmlFor="analysisType" className="flex-1 mr-2">
            Sort:
          </label>
          <select
            id="sortOrder"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="flex-1 border px-2 py-1 rounded text-gray-700"
          >
            <option value="numberServed">Number served</option>
            <option value="totalValue">Total Value</option>
          </select>
        </div>
      </div>


      {rankBy === "biller-ranked" ? ( 
  
         <table className="min-w-full bg-white border">
           <thead className="bg-green-100">
             <tr>
               <th className="border px-4 py-2">No.</th>
               <th className="border px-4 py-2">
                 Biller
               </th>
               <th className="border px-4 py-2">Number Served</th>
               <th className="border px-4 py-2">counter</th>
               <th className="border px-4 py-2">Total Value</th>
             </tr>
           </thead>
           <tbody>
           {sortedGroupedRecords ? (
     sortedGroupedRecords
       .map((record, index: number) => (
                 <tr key={index}>
                   <td className="border px-4 py-2 text-center">{index + 1}</td>
                   <td className="border px-4 py-2">{record.name}</td>
                   <td className="border px-4 py-2">{record.count}</td>
                   <td className="border px-4 py-2">{record.counter}</td>
                   <td className="border px-4 py-2">
                     {record.totalValue.toLocaleString("en-US")}/=
                   </td>
                 </tr>
               ))
             ):(
               <tr>
                   <td
                     colSpan={4}
                     className="text-center py-4"
                   >
                     No records found!
                   </td>
                 </tr>
             )}
            
           </tbody>
         </table>
         ): (

          <>
         <h4 className="my-4 text-center">Shift 1</h4>

     
         <table className="min-w-full bg-white border">
           <thead className="bg-green-100">
             <tr>
               <th className="border px-4 py-2">No.</th>
               <th className="border px-4 py-2">
                 {rankBy === "service" ? "Service Category" : "Biller"}
               </th>
               <th className="border px-4 py-2">Number Served</th>
               {rankBy=="biller"&&<th className="border px-4 py-2">counter</th>}
               <th className="border px-4 py-2">Total Value</th>
             </tr>
           </thead>
           <tbody>
           {sortedGroupedRecords ? (
     sortedGroupedRecords
       .filter((record) => record.shift.toLowerCase() === "shift 1")
       .map((record, index: number) => (
                 <tr key={index}>
                   <td className="border px-4 py-2 text-center">{index + 1}</td>
                   <td className="border px-4 py-2">{record.name}</td>
                   <td className="border px-4 py-2">{record.count}</td>
                   {rankBy=="biller"&&<td className="border px-4 py-2">{record.counter}</td>}
                   <td className="border px-4 py-2">
                     {record.totalValue.toLocaleString("en-US")}/=
                   </td>
                 </tr>
               ))
             ):(
               <tr>
                   <td
                     colSpan={4}
                     className="text-center py-4"
                   >
                     No records found!
                   </td>
                 </tr>
             )}
            
           </tbody>
         </table>
   
   <h4 className="my-4 text-center">Shift 2</h4>
   
         {/* Table of shift 2*/}
         <table className="min-w-full bg-white border">
           <thead className="bg-green-100">
             <tr>
               <th className="border px-4 py-2">No.</th>
               <th className="border px-4 py-2">
                 {rankBy === "service" ? "Service Category" : "Biller"}
               </th>
               <th className="border px-4 py-2">Number Served</th>
               {rankBy=="biller"&&<th className="border px-4 py-2">counter</th>}
               <th className="border px-4 py-2">Total Value</th>
             </tr>
           </thead>
           <tbody>
           {sortedGroupedRecords ? (
     sortedGroupedRecords
       .filter((record) => record.shift.toLowerCase() === "shift 2")
       .map((record, index: number) => (
                 <tr key={index}>
                   <td className="border px-4 py-2 text-center">{index + 1}</td>
                   <td className="border px-4 py-2">{record.name}</td>
                   <td className="border px-4 py-2">{record.count}</td>
                   {rankBy=="biller"&& <td className="border px-4 py-2">{record.counter}</td>}
                   <td className="border px-4 py-2">
                     {record.totalValue.toLocaleString("en-US")}/=
                   </td>
                 </tr>
               ))
             ):(
               <tr>
                   <td
                     colSpan={4}
                     className="text-center py-4"
                   >
                     No records found!
                   </td>
                 </tr>
             )}
            
           </tbody>
         </table>
         </>
      )}

     



      <div className="flex justify-center mt-6 w-fit mx-auto">
        <button
          onClick={generatePDF}
          className="bg-green-800 text-white py-2 px-4 rounded-lg shadow-md hover:bg-green-700"
        >
          Generate PDF
        </button>
      </div>
    </div>
  );
}

