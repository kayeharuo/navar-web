export async function preserveCurrentSnapshot({ name, body, payload, findMatch, create }) {
 const { match } = await findMatch(body);
 if (match) return { snapshot_id: match.id, name: match.name, existing: true };
 if (!name.trim()) throw new Error('Enter a name to preserve your current edits before restoring.');
 return create({ name: name.trim(), payload });
}
