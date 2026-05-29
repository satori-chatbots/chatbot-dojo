const formatAuditDate = (value) => {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleString();
};

const YamlEditorAuditFooter = ({ audit }) => {
  if (!audit) {
    return <></>;
  }

  return (
    <>
      <span>Created by {audit.created_by || "Unknown"}</span>
      <span>Created {formatAuditDate(audit.created_at)}</span>
      <span>Modified by {audit.last_modified_by || "Unknown"}</span>
      <span>Modified {formatAuditDate(audit.last_modified_at)}</span>
    </>
  );
};

export default YamlEditorAuditFooter;
