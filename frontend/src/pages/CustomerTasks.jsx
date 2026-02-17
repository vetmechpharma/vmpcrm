import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { ListTodo, CheckCircle, Clock, Calendar, Loader2, AlertCircle } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CustomerTasks = () => {
  const { customer } = useOutletContext();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const token = localStorage.getItem('customerToken');
      const response = await axios.get(`${API_URL}/api/customer/tasks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTasks(response.data || []);
    } catch (error) {
      console.error('Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  };

  const isOverdue = (dueDate) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const getPriorityConfig = (priority) => {
    const configs = {
      low: { color: 'bg-slate-100 text-slate-600', label: 'Low' },
      moderate: { color: 'bg-amber-100 text-amber-700', label: 'Medium' },
      high: { color: 'bg-red-100 text-red-700', label: 'High' }
    };
    return configs[priority] || configs.low;
  };

  const pendingTasks = tasks.filter(t => t.status !== 'completed');
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const filteredTasks = activeTab === 'pending' ? pendingTasks : completedTasks;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 md:px-6 space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{pendingTasks.length}</p>
                <p className="text-xs text-slate-500">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{completedTasks.length}</p>
                <p className="text-xs text-slate-500">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'pending'
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500'
          }`}
          data-testid="tab-pending"
        >
          Pending ({pendingTasks.length})
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'completed'
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500'
          }`}
          data-testid="tab-completed"
        >
          Completed ({completedTasks.length})
        </button>
      </div>

      {/* Tasks List */}
      {filteredTasks.length === 0 ? (
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <ListTodo className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500">
              {activeTab === 'pending' ? 'No pending tasks' : 'No completed tasks'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((task) => {
            const priorityConfig = getPriorityConfig(task.priority);
            const overdue = isOverdue(task.due_date) && task.status !== 'completed';
            
            return (
              <Card 
                key={task.id}
                className={`rounded-2xl border-0 shadow-sm transition-all ${
                  overdue ? 'ring-2 ring-red-200 bg-red-50/50' : ''
                } ${task.status === 'completed' ? 'opacity-70' : ''}`}
                data-testid={`task-${task.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Status Icon */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      task.status === 'completed' 
                        ? 'bg-emerald-100' 
                        : overdue 
                          ? 'bg-red-100' 
                          : 'bg-amber-100'
                    }`}>
                      {task.status === 'completed' ? (
                        <CheckCircle className="w-5 h-5 text-emerald-600" />
                      ) : overdue ? (
                        <AlertCircle className="w-5 h-5 text-red-600" />
                      ) : (
                        <Clock className="w-5 h-5 text-amber-600" />
                      )}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className={`font-semibold text-slate-800 text-sm ${
                          task.status === 'completed' ? 'line-through text-slate-500' : ''
                        }`}>
                          {task.title}
                        </h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${priorityConfig.color}`}>
                          {priorityConfig.label}
                        </span>
                      </div>
                      
                      {task.description && (
                        <p className={`text-sm mb-2 line-clamp-2 ${
                          task.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-600'
                        }`}>
                          {task.description}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-3 text-xs">
                        {task.due_date && (
                          <span className={`flex items-center gap-1 ${
                            overdue ? 'text-red-600 font-medium' : 'text-slate-500'
                          }`}>
                            <Calendar className="w-3 h-3" />
                            {overdue && 'Overdue: '}
                            {new Date(task.due_date).toLocaleDateString()}
                          </span>
                        )}
                        {task.created_by && (
                          <span className="text-slate-400">
                            by {task.created_by}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CustomerTasks;
