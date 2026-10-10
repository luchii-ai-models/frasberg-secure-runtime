import os,sys,time,requests
sys.path.insert(0,'/app/backend/frasberg_gpu_worker'); import engines
A=os.environ['API']+'/api/gpu';W='e2e-fast';H={'X-Frasberg-Worker-Secret':os.environ['SEC'],'X-Frasberg-Worker-Id':W}
M=sys.argv[1]
end=time.time()+float(sys.argv[2])
while time.time()<end:
    requests.post(A+'/worker/heartbeat',json={'worker_id':W,'models':[M]},headers=H)
    j=requests.post(A+'/worker/claim',json={'worker_id':W,'models':[M]},headers=H).json()['job']
    if not j: time.sleep(2); continue
    print('claimed',j['id'],j['mode'],j['aspect_ratio'],j['duration'],'img' if j.get('image_base64') else '',flush=True)
    data,_=engines.render('frasberg-dev-test',prompt=j['prompt'],duration=1)
    requests.put(f"{A}/worker/jobs/{j['id']}/chunk/0",data=data,headers=H)
    print(requests.post(f"{A}/worker/jobs/{j['id']}/complete",json={'worker_id':W,'chunks':1,'mime':'video/mp4'},headers=H).json(),flush=True)
