from django.urls import path
from . import views

app_name = 'tasks'

urlpatterns = [
    path('', views.index, name='index'),
    path('api/tasks/', views.task_list_create, name='task_list_create'),
    path('api/tasks/<int:task_id>/', views.task_detail_update_delete, name='task_detail_update_delete'),
    path('api/start_timer/', views.start_timer, name='start_timer'),
    path('api/stop_timer/', views.stop_timer, name='stop_timer'),
]