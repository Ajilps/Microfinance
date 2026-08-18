import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';

import api from '../../services/api';

const money = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Number(value || 0));

const formatDate = (value) => (value
  ? new Date(value).toLocaleDateString('en-IN', { dateStyle: 'medium' })
  : 'No activity yet');

const FindUsers = () => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const response = await api.get('/admin/members');
        setMembers(response.data.members || []);
      } catch (error) {
        toast.error(error.response?.data?.message || 'Failed to load members');
      } finally {
        setLoading(false);
      }
    };
    fetchMembers();
  }, []);

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return members.filter((member) => {
      const matchesSearch = !query
        || member.name.toLowerCase().includes(query)
        || member.email.toLowerCase().includes(query);
      const matchesFilter = filter === 'all'
        || (filter === 'outstanding' && member.totalOutstanding > 0)
        || (filter === 'clear' && member.totalOutstanding <= 0)
        || (filter === 'inactive' && !member.lastActivityAt);
      return matchesSearch && matchesFilter;
    });
  }, [filter, members, search]);

  const totals = useMemo(() => members.reduce((result, member) => ({
    savings: result.savings + member.totalSavings,
    outstanding: result.outstanding + member.totalOutstanding,
    activeLoans: result.activeLoans + (member.totalOutstanding > 0 ? 1 : 0),
  }), { savings: 0, outstanding: 0, activeLoans: 0 }), [members]);

  if (loading) return <div className="spinner" aria-label="Loading members" />;

  return (
    <div>
      <div className="page-header member-directory-header">
        <div>
          <h2>Find by User</h2>
          <p>Open one member workspace to view and manage their complete financial and attendance history.</p>
        </div>
      </div>

      <div className="stat-grid member-directory-stats">
        <div className="stat-card">
          <div className="stat-title">Members</div>
          <div className="stat-value">{members.length}</div>
          <div className="stat-sub">Registered member accounts</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Combined Savings</div>
          <div className="stat-value member-value-positive">{money(totals.savings)}</div>
          <div className="stat-sub">Across all members</div>
        </div>
        <div className="stat-card member-unpaid-card">
          <div className="stat-title">Combined Outstanding</div>
          <div className="stat-value member-value-danger">{money(totals.outstanding)}</div>
          <div className="stat-sub">{totals.activeLoans} members with unpaid balances</div>
        </div>
      </div>

      <section className="card member-directory-tools" aria-label="Member search and filters">
        <div className="member-search-box">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by member name or email"
            aria-label="Search members"
          />
        </div>
        <div className="member-filter-group" role="group" aria-label="Filter members">
          {[
            ['all', 'All'],
            ['outstanding', 'Outstanding'],
            ['clear', 'No loan balance'],
            ['inactive', 'No activity'],
          ].map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={`member-filter-button${filter === value ? ' active' : ''}`}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="table-container">
        <div className="member-directory-table-heading">
          <div>
            <h3>Member directory</h3>
            <p>{filteredMembers.length} of {members.length} members</p>
          </div>
        </div>
        {filteredMembers.length ? (
          <div className="table-scroll">
            <table className="data-table member-directory-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Savings</th>
                  <th>Principal Due</th>
                  <th>Interest Due</th>
                  <th>Present Rate</th>
                  <th>Last Activity</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((member) => (
                  <tr key={member.userId}>
                    <td>
                      <div className="member-identity-cell ">
                        <span className="member-list-avatar " aria-hidden="true">
                         <div className= "text-align-center" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', color: '#fff', backgroundColor: '#d9d14228', borderRadius: '50%' }}>
                          
                          {member.name?.[0]?.toUpperCase() || 'M'}
                          </div> 
                          
                        </span>
                        <div>
                          <strong>{member.name}</strong>
                          <span>{member.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="member-value-positive">{money(member.totalSavings)}</td>
                    <td className={member.principalBalance > 0 ? 'member-value-danger' : ''}>
                      {money(member.principalBalance)}
                    </td>
                    <td className={member.interestBalance > 0 ? 'member-value-danger' : ''}>
                      {money(member.interestBalance)}
                    </td>
                    <td>
                      <div className="member-rate-cell">
                        <span>{member.attendanceRate.toFixed(1)}%</span>
                        <small>{member.attendanceSessions} sessions</small>
                      </div>
                    </td>
                    <td>{formatDate(member.lastActivityAt)}</td>
                    <td>
                      <Link className="btn btn-primary member-open-button" to={`/admin/find-user/${member.userId}`}>
                        Open workspace →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="member-empty-state">
            <span aria-hidden="true">⌕</span>
            <h3>No members found</h3>
            <p>Try another name, email, or filter.</p>
          </div>
        )}
      </section>
    </div>
  );
};

export default FindUsers;
