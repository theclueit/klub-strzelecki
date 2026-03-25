import { supabase } from '@/lib/supabase'
import { Users } from 'lucide-react'
import Link from 'next/link'

export const revalidate = 60

const classColors: Record<string, string> = {
  'Mistrz': 'bg-primary/20 text-primary',
  'I': 'bg-blue-500/20 text-blue-400',
  'II': 'bg-green-500/20 text-green-400',
  'III': 'bg-muted/20 text-muted',
}

export default async function MembersPage() {
  const { data: members } = await supabase
    .from('members')
    .select('*')
    .eq('is_active', true)
    .order('full_name')

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="flex items-center gap-3 mb-8">
        <Users className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold">Zawodnicy</h1>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {members?.map((member) => (
          <Link
            key={member.id}
            href={`/zawodnicy/${member.id}`}
            className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                {member.full_name.charAt(0)}
              </div>
              <div>
                <h3 className="font-semibold group-hover:text-primary transition-colors">
                  {member.full_name}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${classColors[member.class]}`}>
                    {member.class}
                  </span>
                  <span className="text-xs text-muted">{member.license_number}</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
