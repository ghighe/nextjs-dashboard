'use server';

import { z } from 'zod';
import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';

export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn('credentials', formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return 'Invalid credentials.';
        default:
          return 'Something went wrong';
      }
    }
    throw error;
  }
}
//define a schema that mach my object for validation purposes
const formSchema = z.object({
  id: z.string(),
  customerId: z.string({ invalid_type_error: 'Please select a customer' }),
  amount: z.coerce
    .number()
    .gt(0, { message: 'Please enter an amount grater than $0.' }),
  status: z.enum(['pending', 'paid'], {
    invalid_type_error: 'Please select an invoice status',
  }),
  date: z.string(),
});

const CreateInvoice = formSchema.omit({ id: true, date: true });
const UpdateInvoice = formSchema.omit({ id: true, date: true });

export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};

export async function createInvoice(prevState: State, formData: FormData) {
  const validatedFields = CreateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  console.log('validatedFields', validatedFields);

  //if form validation fails return errors earlier
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to create Invoice.',
    };
  }

  const { customerId, amount, status } = validatedFields.data;
  //good practice store monetary values in cents in db
  const amountInCents = amount * 100;
  //date format options
  const dateFormat = new Date().toLocaleDateString('ro-Ro', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
  try {
    //insert the formatted and validated obj into the database
    await sql`
      INSERT INTO invoices (customer_id, amount, status, date)
      VALUES (${customerId}, ${amountInCents}, ${status}, ${dateFormat})
    `;
  } catch (e) {
    return {
      errMessage: 'Database error: cannot insert into invoices ',
    };
  }

  // revalidatePath() It's particularly useful for scenarios where you want to ensure the client-side and server-side caches are updated with the latest data when a user visits a particular route
  revalidatePath('dashboard/invoices');
  redirect('/dashboard/invoices');
}

export async function updateInvoice(
  id: string,
  prevState: State,
  formData: FormData,
) {
  //console.log('yes');

  const validatedFields = UpdateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to update Invoice.',
    };
  }

  const { customerId, amount, status } = validatedFields.data;

  const amountInCents = amount * 100;
  try {
    await sql`
     UPDATE invoices
     SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
     WHERE id=${id}
    `;
  } catch (e) {
    return { errMessage: 'Database error: cannot update the invoices' };
  }

  revalidatePath('dashboard/invoices');
  redirect('/dashboard/invoices');
}

export async function deleteInvoice(invoiceId: string) {
  //throw new Error('failed to delete invoice');
  try {
    await sql`DELETE FROM invoices WHERE id=${invoiceId}`;
  } catch (e) {
    return { errMessage: 'Database error: Cannot delete invoice' };
  }
  revalidatePath('dashboard/invoices');
}
