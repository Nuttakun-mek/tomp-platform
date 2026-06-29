# Manual Smoke Test Checklist

| Test | Expected Result |
| --- | --- |
| Login page | Email and Google options render |
| Project list | Projects render from Supabase or fallback |
| Create project | Server action validates and returns result |
| Create mission | Unauthorized users receive action error; fallback user can test |
| Create assignment | Assignment validates project/call sign relationship |
| Publish | Readiness blockers prevent publish |
| Change request | Request is stored and timeline event is prepared |
| Driver token access | Invalid/revoked/expired token is denied |
| Driver activation | Checklist submits readiness data |
| Vehicle photo | File input accepts supported image types |
| Plate photo | File input accepts supported image types |
| Status update | Driver status action creates timeline event |
| Mission Control realtime fallback | Page renders without realtime connection |
| Timeline check | No edit/delete UI exists |

