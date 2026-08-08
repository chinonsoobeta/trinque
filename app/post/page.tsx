"use client";

import { PageContainer } from "@/components/AppPrimitives";
import { PostComposer } from "@/components/post/PostComposer";

export default function PostPage() {
  return <PageContainer className="post-page"><PostComposer /></PageContainer>;
}
