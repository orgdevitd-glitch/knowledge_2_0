import { describe, expect, it } from "vitest";

import { ValidationError } from "@/domain/shared/errors";
import { parseGoogleWorkspaceUrl } from "@/server/google-workspace/url-parser";

describe("parseGoogleWorkspaceUrl", () => {
  it("parses Google Docs URL", () => {
    expect(
      parseGoogleWorkspaceUrl(
        "https://docs.google.com/document/d/abc123XYZ-_/edit?usp=sharing",
      ),
    ).toEqual({
      provider: "google-workspace",
      resourceType: "document",
      externalId: "abc123XYZ-_",
    });
  });

  it("parses Google Sheets URL", () => {
    expect(
      parseGoogleWorkspaceUrl(
        "https://docs.google.com/spreadsheets/d/sheet-id-123/edit#gid=0",
      ),
    ).toEqual({
      provider: "google-workspace",
      resourceType: "spreadsheet",
      externalId: "sheet-id-123",
    });
  });

  it("parses Drive file URL", () => {
    expect(
      parseGoogleWorkspaceUrl(
        "https://drive.google.com/file/d/file-id-123/view",
      ),
    ).toEqual({
      provider: "google-workspace",
      resourceType: "drive-file",
      externalId: "file-id-123",
    });
  });

  it("parses Drive folder URL", () => {
    expect(
      parseGoogleWorkspaceUrl(
        "https://drive.google.com/drive/folders/folder-id-123",
      ),
    ).toEqual({
      provider: "google-workspace",
      resourceType: "drive-folder",
      externalId: "folder-id-123",
    });
  });

  it("parses raw file id", () => {
    expect(parseGoogleWorkspaceUrl("abc123XYZ-_0123456789")).toEqual({
      provider: "google-workspace",
      resourceType: "unknown-id",
      externalId: "abc123XYZ-_0123456789",
    });
  });

  it("rejects unknown host", () => {
    expect(() =>
      parseGoogleWorkspaceUrl("https://example.com/document/d/abc123/edit"),
    ).toThrow(ValidationError);
  });

  it("rejects malformed id", () => {
    expect(() => parseGoogleWorkspaceUrl("abc")).toThrow(ValidationError);
  });

  it("rejects URL credentials", () => {
    expect(() =>
      parseGoogleWorkspaceUrl(
        "https://user:pass@docs.google.com/document/d/abc123/edit",
      ),
    ).toThrow(ValidationError);
  });

  it("rejects unsafe scheme", () => {
    expect(() =>
      parseGoogleWorkspaceUrl("javascript:alert(1)"),
    ).toThrow(ValidationError);
  });

  it("rejects control characters", () => {
    expect(() =>
      parseGoogleWorkspaceUrl("abc123\nmalicious"),
    ).toThrow(ValidationError);
  });

  it("rejects empty input", () => {
    expect(() => parseGoogleWorkspaceUrl("   ")).toThrow(ValidationError);
  });

  it("rejects non-https google url", () => {
    expect(() =>
      parseGoogleWorkspaceUrl("http://docs.google.com/document/d/abc123/edit"),
    ).toThrow(ValidationError);
  });
});
