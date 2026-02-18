function StructuredFields({ fields }) {
  if (!fields) {
    return null
  }
  return (
    <div className="structured-fields">
      <div className="structured-title">Extracted Fields</div>
      <dl>
        {fields.person_name && (
          <>
            <dt>Name</dt>
            <dd>{fields.person_name}</dd>
          </>
        )}
        {fields.date_of_birth && (
          <>
            <dt>Date of Birth</dt>
            <dd>{fields.date_of_birth}</dd>
          </>
        )}
        {fields.id_numbers && fields.id_numbers.length > 0 && (
          <>
            <dt>ID Numbers</dt>
            <dd>{fields.id_numbers.join(", ")}</dd>
          </>
        )}
        {fields.address && (
          <>
            <dt>Address</dt>
            <dd>{fields.address}</dd>
          </>
        )}
        {fields.phone_numbers && fields.phone_numbers.length > 0 && (
          <>
            <dt>Phone</dt>
            <dd>{fields.phone_numbers.join(", ")}</dd>
          </>
        )}
        {fields.emails && fields.emails.length > 0 && (
          <>
            <dt>Email</dt>
            <dd>{fields.emails.join(", ")}</dd>
          </>
        )}
      </dl>
    </div>
  )
}

export default StructuredFields
