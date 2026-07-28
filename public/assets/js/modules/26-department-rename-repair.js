/* Department rename repair: the Users page button existed but renameDept was missing. */
(function(){
  window.renameDept=async function(deptId,currentName){
    try{
      if(!CU || (CU.role!=='pharmacy' && CU.master!==true)){
        return toast('Only the Pharmacy Manager may rename departments.','err');
      }
      var departments=gd();
      var dept=departments.find(function(d){return String(d.id)===String(deptId);});
      if(!dept)return toast('Department not found. Refresh the page and try again.','err');
      var entered=await uiPrompt(
        'Enter the new department name / أدخل اسم القسم الجديد',
        dept.name||currentName||'',
        {title:'Rename Department / تعديل اسم القسم',okText:'Save / حفظ',cancelText:'Cancel / إلغاء'}
      );
      if(entered===null || entered===undefined)return;
      var newName=String(entered).trim().replace(/\s+/g,' ');
      if(!newName)return toast('Department name cannot be empty.','err');
      if(newName===dept.name)return toast('No changes were made.','info');
      var duplicate=departments.some(function(d){
        return String(d.id)!==String(deptId) && String(d.name||'').trim().toLowerCase()===newName.toLowerCase();
      });
      if(duplicate)return toast('A department with this name already exists.','err');

      var updated=departments.map(function(d){
        return String(d.id)===String(deptId)?Object.assign({},d,{name:newName,updated:nowISO()}):d;
      });
      await S.s('departments',updated);

      /* IDs stay unchanged, so users, medicines, requests, expiry data,
         announcements, and department-specific settings remain linked. */
      renderUsers();
      if(typeof fillDS==='function')fillDS();
      if(typeof populateInvDeptSel==='function')populateInvDeptSel();
      if(typeof refreshCurrentPage==='function')refreshCurrentPage();
      toast('Department renamed successfully ✓','succ');
    }catch(err){
      console.error('renameDept failed:',err);
      toast((err&&err.message)||'Could not rename the department.','err');
    }
  };
})();








export {};
