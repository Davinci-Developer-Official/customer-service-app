import { archiveUser } from '@/app/lib/action';
import { UserState } from '@/app/lib/definitions';
import React, { useEffect } from 'react'
import { useFormState } from 'react-dom';
import toast from 'react-hot-toast';

export default function ArchiveModel({ 
    userId,
    role,
    status,
    setShowArchiveModel,
    setUserArchivedId
 }:{ 
    userId:string,
    role:string,
    status:string,
    setShowArchiveModel: (value: boolean) => void,
    setUserArchivedId: (value: string) => void;
 }) {
    const initialState: UserState = { response: null, message: null, errors: {} };
      const archiveUserById = archiveUser.bind(null, userId);
      const [state, formAction] = useFormState(archiveUserById, initialState);

      useEffect(() => {
        if(state.response){
            setShowArchiveModel(false);
            setUserArchivedId('');
            if(state.response === '!ok' && state.message){
                toast.error(state.message)
            }
          }

      })
     

  return (
    <div className="fixed bg-black/60 backdrop-blur-sm inset-0 flex items-center h-full w-full justify-center" style={{ pointerEvents: 'auto' }}>
        <div className="items-center bg-white h-40 w-72 p-4 rounded-lg">
        <p className="text-center mt-4 text-gray-700">Are you sure you want to <br/> <span>{status} user?</span> </p>
        <div className="flex gap-2 mt-4">
            <form action={formAction}>
                <input type="hidden" name="id" value={userId ?? ''} />
                <input type="hidden" name="role" value={role} />
                <input type="hidden" name="status" value={status} />
                
                <button
                    className="!bg-green-800 px-1 py-1 !text-sm !text-gray-white hover:bg-gray-100" 
                    type='submit'
                > 
                    Yes,&nbsp;{status}!
                </button>
            </form>
            <button
                className="!bg-gray-100 px-1 py-1 !text-sm !text-gray-700 hover:bg-gray-100"
                onClick={() => {
                    setShowArchiveModel(false),
                    setUserArchivedId('')
                }}
            >
                Cancel
            </button>
        </div>
        
        </div>
    </div>
    )
}
