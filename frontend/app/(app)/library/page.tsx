"use client";

import { TopBar } from "@/components/layout/TopBar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileUploadDropzone } from "@/components/files/FileUploadDropzone";
import { FileListTable } from "@/components/files/FileListTable";

export default function LibraryPage() {
  return (
    <>
      <TopBar title="Study Library" description="Upload course notes and manage your vector knowledge base" />
      <div className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Add Study Material</CardTitle>
            <CardDescription>PDF, DOCX, and PPTX files are chunked and embedded automatically</CardDescription>
          </CardHeader>
          <CardContent>
            <FileUploadDropzone />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Document Library</CardTitle>
            <CardDescription>Active references in your vector knowledge base</CardDescription>
          </CardHeader>
          <CardContent>
            <FileListTable />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
