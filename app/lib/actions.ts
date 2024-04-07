'use server';
import { z } from 'zod';
import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

//define a schema that mach my object for validation purposes
const formSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  amount: z.coerce.number(),
  status: z.enum(['pending', 'paid']),
  date: z.string(),
});

const CreateInvoice = formSchema.omit({ id: true, date: true });

export async function createInvoice(formData: FormData) {
  //console.log(typeof formData);
  const { customerId, amount, status } = CreateInvoice.parse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });
  //good practice store monetary values in cents in db
  const amountInCents = amount * 100;
  //date format options
  const dateFormat = new Date().toLocaleDateString('ro-Ro', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
  //insert the formatted and validated obj into the database
  await sql`
    INSERT INTO invoices (customer_id, amount, status, date)
    VALUES (${customerId}, ${amountInCents}, ${status}, ${dateFormat})
  `;
  // revalidatePath() It's particularly useful for scenarios where you want to ensure the client-side and server-side caches are updated with the latest data when a user visits a particular route
  revalidatePath('dashboard/invoices');
  redirect('/dashboard/invoices');
}
