using Microsoft.EntityFrameworkCore;

namespace TicketManagement.Api.Data;

public class TicketManagementDbContext : DbContext
{
    public TicketManagementDbContext(DbContextOptions<TicketManagementDbContext> options)
        : base(options)
    {
    }
}
